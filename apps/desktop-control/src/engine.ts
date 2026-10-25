import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

export type DesktopMode = "support" | "game";
export type DesktopRole = "host" | "client";

export interface DesktopSessionDescriptor {
  sessionId: string;
  deviceId: string;
  mode: DesktopMode;
  role: DesktopRole;
  remoteId?: string;
  accessToken?: string;
  expiresAt?: string;
  apiUrl?: string;
  realtimeUrl?: string;
}

export interface EngineReadiness {
  ready: boolean;
  code: "ready" | "missing-engine" | "unsupported-platform" | "not-implemented";
  message: string;
}

export interface EngineLaunchResult {
  started: boolean;
  message: string;
}

export interface DesktopEngine {
  readonly mode: DesktopMode;
  check(): Promise<EngineReadiness>;
  start(session: DesktopSessionDescriptor): Promise<EngineLaunchResult>;
  stop(session: DesktopSessionDescriptor): Promise<EngineLaunchResult>;
}

export function createDesktopEngine(mode: DesktopMode): DesktopEngine {
  return mode === "support" ? new SupportEngine() : new GameEngine();
}

class SupportEngine implements DesktopEngine {
  readonly mode = "support" as const;

  async check(): Promise<EngineReadiness> {
    const executable = await findRustDesk();
    return executable
      ? { ready: true, code: "ready", message: `RustDesk detectado em ${executable}` }
      : { ready: false, code: "missing-engine", message: "Cliente de suporte nao encontrado neste computador." };
  }

  async start(session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    if (!session.remoteId) return { started: false, message: "O identificador remoto nao foi informado." };
    const remoteId = session.remoteId;
    const executable = await findRustDesk();
    if (!executable) return { started: false, message: "Cliente de suporte nao encontrado neste computador." };

    return new Promise<EngineLaunchResult>((resolve) => {
      const child = spawn(executable, ["--connect", remoteId], {
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      child.once("error", (error) => resolve({ started: false, message: `Cliente de suporte nao iniciou: ${error.message}` }));
      child.once("spawn", () => {
        child.unref();
        resolve({ started: true, message: "Cliente de suporte iniciado." });
      });
    });
  }

  async stop(_session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    return { started: true, message: "Encerramento solicitado ao cliente de suporte." };
  }
}

class GameEngine implements DesktopEngine {
  readonly mode = "game" as const;

  async check(): Promise<EngineReadiness> {
    if (process.platform !== "win32") {
      return { ready: false, code: "unsupported-platform", message: "O cliente operador nativo esta disponivel para Windows." };
    }

    const launch = await findOperatorLaunch();
    return launch
      ? { ready: true, code: "ready", message: `Cliente operador nativo detectado em ${launch.command}` }
      : { ready: false, code: "missing-engine", message: "Instale o Remoto Operator para abrir sessoes de jogo." };
  }

  async start(session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    if (session.role !== "client" || session.mode !== "game") {
      return { started: false, message: "O cliente operador exige uma sessao aprovada no modo jogo." };
    }
    if (!session.accessToken) return { started: false, message: "A sessao aprovada nao possui accessToken." };

    const launch = await findOperatorLaunch();
    if (!launch) return { started: false, message: "Instale o Remoto Operator para abrir sessoes de jogo." };

    const descriptor = await createOperatorDescriptorFile(session);
    const child = spawn(launch.command, [...launch.args, "--descriptor-file", descriptor.file], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    const entry = { child, directory: descriptor.directory };
    activeOperatorProcesses.set(session.sessionId, entry);
    const cleanup = () => {
      if (activeOperatorProcesses.get(session.sessionId)?.child === child) activeOperatorProcesses.delete(session.sessionId);
      void fs.rm(descriptor.directory, { recursive: true, force: true });
    };
    child.once("error", cleanup);
    child.once("exit", cleanup);
    child.unref();
    return { started: true, message: "Cliente operador nativo iniciado." };
  }

  async stop(session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    const entry = activeOperatorProcesses.get(session.sessionId);
    if (!entry) return { started: true, message: "Nenhum cliente operador local estava associado a sessao." };
    activeOperatorProcesses.delete(session.sessionId);
    entry.child.kill();
    await fs.rm(entry.directory, { recursive: true, force: true });
    return { started: true, message: "Cliente operador nativo encerrado." };
  }
}

const activeOperatorProcesses = new Map<string, { child: ReturnType<typeof spawn>; directory: string }>();

async function findOperatorLaunch() {
  if (process.platform !== "win32") return null;
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const installedCandidates = [
    process.env.REMOTO_OPERATOR_PATH,
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Remoto", "Remoto.exe"),
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Remoto", "Remoto.exe"),
    path.join(workspaceRoot, "apps", "operator", "release", "win-unpacked", "Remoto.exe")
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of installedCandidates) {
    if (await fileExists(candidate)) return { command: candidate, args: [] };
  }

  const operatorRoot = process.env.REMOTO_OPERATOR_DIR ?? path.join(workspaceRoot, "apps", "operator");
  const electron = process.env.REMOTO_ELECTRON_PATH ?? path.join(workspaceRoot, "node_modules", "electron", "dist", "electron.exe");
  if (await fileExists(path.join(operatorRoot, "src", "main.cjs")) && await fileExists(electron)) {
    return { command: electron, args: [operatorRoot] };
  }
  return null;
}

async function createOperatorDescriptorFile(session: DesktopSessionDescriptor) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "remoto-session-"));
  const file = path.join(directory, "session.remoto-session");
  await fs.writeFile(file, JSON.stringify({
    ...session,
    apiUrl: session.apiUrl ?? process.env.REMOTO_API_URL ?? "http://localhost:4100",
    realtimeUrl: session.realtimeUrl ?? process.env.REMOTO_REALTIME_URL ?? "ws://localhost:4200"
  }), { encoding: "utf8", mode: 0o600 });
  return { directory, file };
}

async function fileExists(candidate: string) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findRustDesk() {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.env.ProgramFiles ?? "C:\\Program Files", "RustDesk", "rustdesk.exe"),
        path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "RustDesk", "rustdesk.exe")
      ]
    : ["/usr/bin/rustdesk", "/usr/local/bin/rustdesk"];

  for (const candidate of candidates) {
    try {
      if (candidate.includes(path.sep)) {
        await fs.access(candidate);
        return candidate;
      }
    } catch {
      // Continue checking the remaining installation locations.
    }
  }

  const command = process.platform === "win32" ? "where.exe" : "which";
  const executableName = process.platform === "win32" ? "rustdesk.exe" : "rustdesk";
  try {
    const { stdout } = await execFileAsync(command, [executableName], { timeout: 2_000, windowsHide: true });
    const discovered = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return discovered && await fileExists(discovered) ? discovered : null;
  } catch {
    return null;
  }
}
