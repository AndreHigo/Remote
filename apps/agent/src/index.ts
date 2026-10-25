import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { connectRemoteSession, type RealtimeConnection } from "@remoto/desktop-control/realtime";
import { resolveFfmpegExecutable } from "@remoto/desktop-control/capture";
import { validateEndpointUrl } from "./url-policy.js";
import { buildCaptureReadiness, readCaptureProfile } from "./capture-config.js";

const execFileAsync = promisify(execFile);
const packagedProcess = process as NodeJS.Process & { pkg?: unknown };
const runtimeRoot = packagedProcess.pkg ? path.dirname(process.execPath) : process.cwd();
const CONFIG_FILE = process.env.REMOTO_AGENT_CONFIG ?? path.join(runtimeRoot, ".remoto-agent.config.json");
const activeRemoteSessions = new Map<string, RealtimeConnection>();

interface AgentConfigFile {
  apiUrl?: string;
  realtimeUrl?: string;
  agentKey?: string;
  stateFile?: string;
  ffmpegPath?: string;
  captureQuality?: string;
  captureEncoder?: string;
  captureWidth?: number | string;
  captureHeight?: number | string;
  captureFps?: number | string;
  captureBitrateKbps?: number | string;
}

interface AgentConfig {
  apiUrl: string;
  realtimeUrl: string;
  agentKey: string;
  stateFile: string;
  heartbeatIntervalSeconds: number;
  commandIntervalSeconds: number;
  inventoryIntervalSeconds: number;
  remoteSessionIntervalSeconds: number;
  ffmpegPath?: string;
  captureProfile: ReturnType<typeof readCaptureProfile>;
}

let config: AgentConfig;

interface DeviceResponse {
  id: string;
  displayName: string;
  remoteId: string;
  status: "online" | "offline";
  lastSeenAt: string | null;
}

interface AgentState {
  deviceId: string;
  remoteId: string;
  displayName: string;
}

interface InventoryResponse {
  id: string;
  deviceId: string;
  collectedAt: string;
}

interface CommandResponse {
  id: string;
  deviceId: string;
  commandType: "ping" | "system-info" | "refresh-inventory";
  status: "pending" | "running" | "succeeded" | "failed";
  payload: Record<string, unknown>;
}

interface RemoteSessionResponse {
  sessionId: string;
  deviceId: string;
  mode: "support" | "game";
  role: "host";
  accessToken: string;
  expiresAt: string;
}

const command = process.argv[2] ?? "register";

async function main() {
  if (command === "config:init") {
    await initializeConfig();
    return;
  }

  config = await loadConfig();

  if (command === "status") {
    await printStatus();
    return;
  }

  if (command === "register") {
    const device = await registerDevice();
    await saveState({
      deviceId: device.id,
      remoteId: device.remoteId,
      displayName: device.displayName
    });
    printDevice("registrado", device);
    return;
  }

  if (command === "heartbeat") {
    const state = (await loadState()) ?? (await registerAndSave());
    const device = await heartbeatWithRecovery(state);
    printDevice("heartbeat", device);
    return;
  }

  if (command === "inventory") {
    const state = (await loadState()) ?? (await registerAndSave());
    await collectAndSendInventory(state);
    return;
  }

  if (command === "commands") {
    const state = (await loadState()) ?? (await registerAndSave());
    const processed = await processCommands(state);
    console.log(processed === 0 ? "comandos: nenhum pendente" : `comandos: ${processed} processado(s)`);
    return;
  }

  if (command === "loop") {
    const state = (await loadState()) ?? (await registerAndSave());
    await runLoop(state);
    return;
  }

  if (command === "sessions") {
    const state = (await loadState()) ?? (await registerAndSave());
    await runSessionLoop(state);
    return;
  }

  throw new Error(`Comando desconhecido: ${command}`);
}

async function registerAndSave() {
  const device = await registerDevice();
  const state = {
    deviceId: device.id,
    remoteId: device.remoteId,
    displayName: device.displayName
  };
  await saveState(state);
  return state;
}

async function refreshState(state: AgentState) {
  const refreshed = await registerAndSave();
  state.deviceId = refreshed.deviceId;
  state.remoteId = refreshed.remoteId;
  state.displayName = refreshed.displayName;
}

function isMissingDeviceError(error: unknown) {
  return error instanceof Error && /API 404:.*Dispositivo nao encontrado/i.test(error.message);
}

async function heartbeatWithRecovery(state: AgentState) {
  try {
    return await heartbeat(state.deviceId);
  } catch (error) {
    if (!isMissingDeviceError(error)) throw error;
    console.log("dispositivo ausente na API; refazendo o cadastro automaticamente");
    await refreshState(state);
    return heartbeat(state.deviceId);
  }
}

async function registerDevice() {
  const payload = await getDevicePayload();
  return post<DeviceResponse>("/agent/devices/register", payload);
}

async function heartbeat(deviceId: string) {
  return post<DeviceResponse>(`/agent/devices/${deviceId}/heartbeat`);
}

async function getDeviceStatus(deviceId: string) {
  return get<DeviceResponse>(`/agent/devices/${deviceId}/status`);
}

async function sendInventory(deviceId: string, inventory: Awaited<ReturnType<typeof collectInventory>>) {
  return post<InventoryResponse>(`/agent/devices/${deviceId}/inventory`, inventory);
}

async function collectAndSendInventory(state: AgentState) {
  const inventory = await collectInventory();
  let snapshot: InventoryResponse;
  try {
    snapshot = await sendInventory(state.deviceId, inventory);
  } catch (error) {
    if (!isMissingDeviceError(error)) throw error;
    console.log("dispositivo ausente na API; refazendo o cadastro antes do inventario");
    await refreshState(state);
    snapshot = await sendInventory(state.deviceId, inventory);
  }
  console.log(`inventario: ${state.displayName} snapshot=${snapshot.id} collectedAt=${snapshot.collectedAt}`);
}

async function claimCommands(deviceId: string) {
  return get<CommandResponse[]>(`/agent/devices/${deviceId}/commands`);
}

async function getRemoteSessions(deviceId: string) {
  return get<RemoteSessionResponse[]>(`/agent/devices/${deviceId}/remote-sessions`);
}

async function completeCommand(
  commandId: string,
  result: { status: "succeeded" | "failed"; output?: Record<string, unknown>; error?: string | null }
) {
  return post<CommandResponse>(`/agent/commands/${commandId}/result`, result);
}

async function get<T>(route: string) {
  const response = await fetch(`${config.apiUrl}${route}`, {
    headers: {
      "x-agent-key": config.agentKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

async function runLoop(state: AgentState) {
  const sessionsEnabled = process.env.REMOTO_AGENT_MANAGEMENT_ONLY !== "1";
  console.log(
    `Agente Remoto ativo para ${state.displayName}. ` +
    `heartbeat=${config.heartbeatIntervalSeconds}s comandos=${config.commandIntervalSeconds}s inventario=${config.inventoryIntervalSeconds}s ` +
    `sessoes=${sessionsEnabled ? `${config.remoteSessionIntervalSeconds}s` : "desativadas (management-only)"}.`
  );

  await runSafely("heartbeat", async () => {
    const device = await heartbeatWithRecovery(state);
    printDevice("heartbeat", device);
  });
  await runSafely("commands", async () => {
    const processed = await processCommands(state);
    if (processed > 0) console.log(`comandos: ${processed} processado(s)`);
  });
  await runSafely("inventory", async () => {
    await collectAndSendInventory(state);
  });
  if (sessionsEnabled) {
    await runSafely("sessoes-remotas", async () => {
      await reportRemoteSessions(state);
    });
  }

  const timers = [
    setInterval(() => {
      void runSafely("heartbeat", async () => {
        const device = await heartbeatWithRecovery(state);
        printDevice("heartbeat", device);
      });
    }, config.heartbeatIntervalSeconds * 1000),
    setInterval(() => {
      void runSafely("commands", async () => {
        const processed = await processCommands(state);
        if (processed > 0) console.log(`comandos: ${processed} processado(s)`);
      });
    }, config.commandIntervalSeconds * 1000),
    setInterval(() => {
      void runSafely("inventory", async () => {
        await collectAndSendInventory(state);
      });
    }, config.inventoryIntervalSeconds * 1000),
    ...(sessionsEnabled ? [setInterval(() => {
      void runSafely("sessoes-remotas", async () => {
        await reportRemoteSessions(state);
      });
    }, config.remoteSessionIntervalSeconds * 1000)] : [])
  ];

  process.on("SIGINT", () => {
    timers.forEach((timer) => clearInterval(timer));
    console.log("Agente Remoto encerrado.");
    process.exit(0);
  });
}

async function runSessionLoop(state: AgentState) {
  console.log(`Agente Remoto desktop ativo para ${state.displayName}. sessoes=${config.remoteSessionIntervalSeconds}s.`);
  await runSafely("sessoes-remotas", async () => {
    await reportRemoteSessions(state);
  });

  const timer = setInterval(() => {
    void runSafely("sessoes-remotas", async () => {
      await reportRemoteSessions(state);
    });
  }, config.remoteSessionIntervalSeconds * 1000);

  process.on("SIGINT", () => {
    clearInterval(timer);
    for (const connection of activeRemoteSessions.values()) connection.close();
    console.log("Agente Remoto desktop encerrado.");
    process.exit(0);
  });
}

async function reportRemoteSessions(state: AgentState) {
  const sessions = await getRemoteSessions(state.deviceId);
  const approvedIds = new Set(sessions.map((session) => session.sessionId));

  for (const [sessionId, connection] of activeRemoteSessions) {
    if (!approvedIds.has(sessionId)) {
      connection.close();
      activeRemoteSessions.delete(sessionId);
    }
  }

  for (const session of sessions) {
    if (session.mode !== "game" || activeRemoteSessions.has(session.sessionId)) continue;
    try {
      const connection = await connectRemoteSession(session, {
        url: config.realtimeUrl,
        capture: { ...config.captureProfile, ffmpegPath: config.ffmpegPath },
        onClosed: (reason) => {
          activeRemoteSessions.delete(session.sessionId);
          console.log(`sessao remota encerrada: ${session.sessionId} (${reason})`);
        }
      });
      activeRemoteSessions.set(session.sessionId, connection);
      console.log(`sessao remota host conectada: ${session.sessionId}`);
    } catch (error) {
      console.error(`sessao remota ${session.sessionId} indisponivel: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function runSafely(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.error(`${label} falhou: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function post<T>(route: string, body?: unknown) {
  const response = await fetch(`${config.apiUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-key": config.agentKey
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

async function getDevicePayload() {
  const hostname = os.hostname();
  const identity = await collectDeviceIdentity();
  const remoteId = process.env.REMOTO_REMOTE_ID ?? (await getRustDeskRemoteId()) ?? buildRemoteId(hostname);

  return {
    displayName: process.env.REMOTO_DEVICE_NAME ?? hostname,
    remoteId,
    os: `${os.type()} ${os.release()}`,
    userName: os.userInfo().username,
    localIp: getLocalIp(),
    biosSerial: identity.biosSerial,
    systemUuid: identity.systemUuid,
    primaryMac: identity.primaryMac,
    identityHash: identity.identityHash,
    tags: getTags()
  };
}

async function collectInventory() {
  const cpus = os.cpus();
  const disks = await getDisks();
  const graphics = await collectGraphicsInventory();
  const identity = await collectDeviceIdentity();

  return {
    hardware: {
      hostname: os.hostname(),
      identity,
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(os.uptime()),
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model ?? "desconhecido",
        speedMhz: cpus[0]?.speed ?? null
      },
      memory: {
        totalBytes: os.totalmem(),
        freeBytes: os.freemem()
      },
      disks,
      graphics,
      network: getNetworkAddresses(),
      collectedAt: new Date().toISOString()
    },
    software: {
      runtime: {
        node: process.version,
        agent: "remoto-agent-cli",
        agentVersion: "0.1.0"
      },
      capture: buildCaptureReadiness(config.captureProfile, Boolean(resolveFfmpegExecutable(config.ffmpegPath))),
      installed: []
    }
  };
}

async function executeCommand(deviceId: string, pendingCommand: CommandResponse) {
  try {
    if (pendingCommand.commandType === "ping") {
      return {
        status: "succeeded" as const,
        output: {
          message: "pong",
          hostname: os.hostname(),
          executedAt: new Date().toISOString()
        }
      };
    }

    if (pendingCommand.commandType === "system-info") {
      return {
        status: "succeeded" as const,
        output: {
          hostname: os.hostname(),
          os: `${os.type()} ${os.release()}`,
          arch: os.arch(),
          uptimeSeconds: Math.round(os.uptime()),
          memory: {
            totalBytes: os.totalmem(),
            freeBytes: os.freemem()
          },
          localIp: getLocalIp()
        }
      };
    }

    if (pendingCommand.commandType === "refresh-inventory") {
      const inventory = await collectInventory();
      const snapshot = await sendInventory(deviceId, inventory);
      return {
        status: "succeeded" as const,
        output: {
          snapshotId: snapshot.id,
          collectedAt: snapshot.collectedAt
        }
      };
    }

    return {
      status: "failed" as const,
      error: `Comando nao permitido: ${pendingCommand.commandType}`
    };
  } catch (error) {
    return {
      status: "failed" as const,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function processCommands(state: AgentState) {
  let commands: CommandResponse[];
  try {
    commands = await claimCommands(state.deviceId);
  } catch (error) {
    if (!isMissingDeviceError(error)) throw error;
    console.log("dispositivo ausente na API; refazendo o cadastro antes dos comandos");
    await refreshState(state);
    commands = await claimCommands(state.deviceId);
  }

  for (const pendingCommand of commands) {
    const result = await executeCommand(state.deviceId, pendingCommand);
    await completeCommand(pendingCommand.id, result);
    console.log(`comando: ${pendingCommand.commandType} ${result.status}`);
  }

  return commands.length;
}

async function getDisks() {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress"
      ]);
      const parsed = JSON.parse(stdout.trim() || "[]");
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows.map((disk) => ({
        name: String(disk.DeviceID),
        totalBytes: Number(disk.Size ?? 0),
        freeBytes: Number(disk.FreeSpace ?? 0)
      }));
    } catch {
      return [];
    }
  }

  try {
    const { stdout } = await execFileAsync("df", ["-kP"]);
    return stdout
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .map(([name, blocks, _used, available, _capacity, mountedAt]) => ({
        name,
        mountedAt,
        totalBytes: Number(blocks) * 1024,
        freeBytes: Number(available) * 1024
      }));
  } catch {
    return [];
  }
}

async function collectGraphicsInventory() {
  if (process.platform !== "win32") {
    return { adapters: [], encoding: "unknown" };
  }

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress"
    ]);
    const parsed = JSON.parse(stdout.trim() || "[]");
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const adapters = rows.map((adapter) => ({
      name: String(adapter.Name ?? "desconhecido"),
      adapterRamBytes: Number(adapter.AdapterRAM ?? 0),
      driverVersion: String(adapter.DriverVersion ?? "desconhecido")
    }));
    const hasUsableAdapter = adapters.some((adapter) => !/microsoft basic|remote display/i.test(adapter.name));

    return {
      adapters,
      encoding: hasUsableAdapter ? "hardware-preferred-with-cpu-fallback" : "cpu-fallback"
    };
  } catch {
    return { adapters: [], encoding: "unavailable" };
  }
}

function getNetworkAddresses() {
  const result: Array<{ name: string; address: string; mac: string }> = [];

  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        result.push({ name, address: entry.address, mac: entry.mac });
      }
    }
  }

  return result;
}

async function collectDeviceIdentity() {
  const [biosSerial, systemUuid] =
    process.platform === "win32"
      ? await Promise.all([getWindowsCimValue("Win32_BIOS", "SerialNumber"), getWindowsCimValue("Win32_ComputerSystemProduct", "UUID")])
      : [null, null];

  const primaryMac = getPrimaryMac();
  const identityHash = crypto
    .createHash("sha256")
    .update([biosSerial, systemUuid, primaryMac, os.hostname()].filter(Boolean).join("|").toLowerCase())
    .digest("hex");

  return {
    biosSerial,
    systemUuid,
    primaryMac,
    identityHash
  };
}

async function getWindowsCimValue(className: string, propertyName: string) {
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `(Get-CimInstance ${className} | Select-Object -First 1 -ExpandProperty ${propertyName})`
    ]);
    return normalizeHardwareIdentity(stdout);
  } catch {
    return null;
  }
}

function getPrimaryMac() {
  return getNetworkAddresses()[0]?.mac ?? null;
}

function normalizeHardwareIdentity(value: string) {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  const invalidValues = new Set([
    "",
    "default string",
    "none",
    "null",
    "system serial number",
    "to be filled by o.e.m.",
    "to be filled by oem",
    "unknown"
  ]);

  if (invalidValues.has(lower)) return null;
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(normalized)) return null;
  return normalized;
}

function buildRemoteId(input: string) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const numeric = Number.parseInt(hash.slice(0, 12), 16).toString().padStart(12, "0").slice(0, 9);
  return `${numeric.slice(0, 3)} ${numeric.slice(3, 6)} ${numeric.slice(6, 9)}`;
}

function getLocalIp() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }

  return "127.0.0.1";
}

function getTags() {
  return (process.env.REMOTO_AGENT_TAGS ?? "windows,agent")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function getRustDeskRemoteId() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.ProgramFiles ?? "C:\\Program Files", "RustDesk", "rustdesk.exe"),
          path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "RustDesk", "rustdesk.exe")
        ]
      : ["rustdesk"];

  for (const executable of candidates) {
    try {
      const { stdout } = await execFileAsync(executable, ["--get-id"], {
        timeout: 3000,
        windowsHide: true
      });
      const remoteId = stdout.trim().split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (remoteId && /^[a-zA-Z0-9][a-zA-Z0-9 -]{3,31}$/.test(remoteId)) return remoteId;
    } catch {
      // RustDesk is optional while the agent is used as a management-only simulator.
    }
  }

  return null;
}

async function loadConfig(): Promise<AgentConfig> {
  let fileConfig: AgentConfigFile = {};

  try {
    fileConfig = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8")) as AgentConfigFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Configuracao invalida em ${CONFIG_FILE}`);
    }
  }

  const stateFile = process.env.REMOTO_AGENT_STATE ?? fileConfig.stateFile ?? ".remoto-agent.json";
  const apiUrl = validateEndpointUrl(process.env.REMOTO_API_URL ?? fileConfig.apiUrl ?? "http://localhost:4100", "api");
  const realtimeUrl = validateEndpointUrl(process.env.REMOTO_REALTIME_URL ?? fileConfig.realtimeUrl ?? "ws://localhost:4200", "realtime");

  const agentKey = process.env.REMOTO_AGENT_KEY ?? fileConfig.agentKey;
  if (!agentKey) throw new Error(`agentKey ausente em ${CONFIG_FILE}. Gere uma chave no painel antes de iniciar o agente.`);

  return {
    apiUrl,
    realtimeUrl,
    agentKey,
    stateFile: path.isAbsolute(stateFile) ? stateFile : path.resolve(path.dirname(CONFIG_FILE), stateFile),
    heartbeatIntervalSeconds: readInterval("REMOTO_AGENT_HEARTBEAT_SECONDS", 30),
    commandIntervalSeconds: readInterval("REMOTO_AGENT_COMMAND_SECONDS", 10),
    inventoryIntervalSeconds: readInterval("REMOTO_AGENT_INVENTORY_SECONDS", 300),
    remoteSessionIntervalSeconds: readInterval("REMOTO_AGENT_SESSION_SECONDS", 5),
    ffmpegPath: process.env.REMOTO_FFMPEG_PATH ?? fileConfig.ffmpegPath,
    captureProfile: readCaptureProfile(fileConfig)
  };
}

async function initializeConfig() {
  try {
    await fs.access(CONFIG_FILE);
    console.log(`configuracao ja existe: ${CONFIG_FILE}`);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  const initialConfig: AgentConfigFile = {
    apiUrl: process.env.REMOTO_API_URL ?? "http://localhost:4100",
    realtimeUrl: process.env.REMOTO_REALTIME_URL ?? "ws://localhost:4200",
    agentKey: process.env.REMOTO_AGENT_KEY ?? "",
    stateFile: process.env.REMOTO_AGENT_STATE ?? ".remoto-agent.json",
    captureQuality: process.env.REMOTO_CAPTURE_QUALITY ?? "auto",
    captureEncoder: process.env.REMOTO_CAPTURE_ENCODER ?? "cpu"
  };
  await fs.writeFile(CONFIG_FILE, `${JSON.stringify(initialConfig, null, 2)}\n`, "utf8");
  console.log(`configuracao criada: ${CONFIG_FILE}`);
  console.log("preencha agentKey com uma chave de agente antes de iniciar o loop");
}

async function printStatus() {
  const health = await checkApiHealth();
  const realtimeHealth = await checkRealtimeHealth();
  const hasKey = Boolean(config.agentKey.trim());
  const state = await loadState();

  console.log("agente.status");
  console.log(`config.file=${CONFIG_FILE}`);
  console.log(`state.file=${config.stateFile}`);
  console.log(`api.url=${config.apiUrl}`);
  console.log(`realtime.url=${config.realtimeUrl}`);
  console.log(`api.reachable=${health.reachable} status=${health.status ?? "-"}`);
  console.log(`realtime.reachable=${realtimeHealth.reachable} status=${realtimeHealth.status ?? "-"}`);
  console.log(`agent.key.configured=${hasKey}`);
  console.log(`capture.profile=${config.captureProfile.quality}`);
  console.log(`capture.encoder=${config.captureProfile.encoder}`);
  console.log(`capture.fps=${config.captureProfile.fps ?? "auto"}`);
  console.log(`capture.bitrateKbps=${config.captureProfile.bitrateKbps ?? "auto"}`);
  console.log(`capture.size=${config.captureProfile.width && config.captureProfile.height ? `${config.captureProfile.width}x${config.captureProfile.height}` : "desktop"}`);
  console.log(`capture.ffmpeg=${resolveFfmpegExecutable(config.ffmpegPath) ?? "nao-encontrado"}`);

  if (!state) {
    console.log("device.state=nao-registrado");
    return;
  }

  console.log(`device.id=${state.deviceId}`);
  console.log(`device.name=${state.displayName}`);

  if (!hasKey) {
    console.log("device.apiStatus=indisponivel-chave-ausente");
    return;
  }

  try {
    const device = await getDeviceStatus(state.deviceId);
    console.log(`device.apiStatus=${device.status}`);
    console.log(`device.lastSeenAt=${device.lastSeenAt ?? "-"}`);
  } catch (error) {
    console.log(`device.apiStatus=erro ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${config.apiUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return { reachable: response.ok, status: response.status };
  } catch {
    return { reachable: false, status: null };
  }
}

async function checkRealtimeHealth() {
  try {
    const healthUrl = config.realtimeUrl.replace(/^ws/i, "http").replace(/\/$/, "") + "/health";
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
    return { reachable: response.ok, status: response.status };
  } catch {
    return { reachable: false, status: null };
  }
}

function readInterval(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return value;
}

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(config.stateFile, "utf8")) as AgentState;
  } catch {
    return null;
  }
}

async function saveState(state: AgentState) {
  await fs.mkdir(path.dirname(config.stateFile), { recursive: true });
  await fs.writeFile(config.stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function printDevice(action: string, device: DeviceResponse) {
  console.log(`${action}: ${device.displayName} (${device.id}) ${device.status} lastSeenAt=${device.lastSeenAt}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
