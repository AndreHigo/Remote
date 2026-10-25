const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow;
let nativeSession;
let activeDescriptor;
let reconnectTimer;
let reconnectAttempt = 0;
let closingSession = false;
let sessionModule;
let firstFrameTimer;

function parseArgs(argv) {
  const index = argv.indexOf("--descriptor-file");
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const associatedFile = argv.find((value) => /\.(?:remoto-session|json)$/i.test(value) && !value.endsWith(".exe"));
  if (associatedFile) return associatedFile;
  return process.env.REMOTO_OPERATOR_DESCRIPTOR || "";
}

async function readDescriptor(filePath) {
  if (!filePath) throw new Error("Informe --descriptor-file com o descritor da sessao aprovada.");
  const resolvedPath = path.resolve(filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const descriptor = JSON.parse(raw);
  if (!descriptor || typeof descriptor !== "object") throw new Error("Descritor de sessao invalido.");
  if (descriptor.role !== "client" || descriptor.mode !== "game") {
    throw new Error("O cliente nativo exige uma sessao aprovada no modo jogo.");
  }
  for (const field of ["sessionId", "deviceId", "accessToken"]) {
    if (typeof descriptor[field] !== "string" || descriptor[field].length < 1) {
      throw new Error(`Descritor sem ${field}.`);
    }
  }
  if (descriptor.expiresAt && (!Number.isFinite(Date.parse(descriptor.expiresAt)) || Date.parse(descriptor.expiresAt) <= Date.now())) {
    throw new Error("O descritor da sessao expirou.");
  }
  return descriptor;
}

async function removeDescriptor(filePath) {
  await fs.rm(path.resolve(filePath), { force: true });
}

function isLoopback(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function normalizeEndpoint(rawValue, kind) {
  const value = String(rawValue || (kind === "api" ? "http://localhost:4100" : "ws://localhost:4200"));
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Endpoint ${kind} invalido.`);
  }
  const allowedProtocols = kind === "api" ? ["http:", "https:"] : ["ws:", "wss:"];
  if (!allowedProtocols.includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`Endpoint ${kind} nao permitido.`);
  }
  if (!isLoopback(url.hostname) && ((kind === "api" && url.protocol !== "https:") || (kind === "realtime" && url.protocol !== "wss:"))) {
    throw new Error(`Endpoint ${kind} remoto exige ${kind === "api" ? "HTTPS" : "WSS"}.`);
  }
  return url.toString().replace(/\/+$/, "");
}

async function consumeSession(descriptor, apiUrl) {
  let response;
  try {
    response = await fetch(`${apiUrl}/desktop-sessions/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: descriptor.accessToken }),
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    throw new Error(`Nao foi possivel consumir a sessao pela API: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `A API recusou a sessao (${response.status}).`);
  }
  return descriptor;
}

function sendStatus(status, detail = "") {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("status", { status, detail });
}

function sendMetrics(metrics) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("metrics", metrics);
}

function sendSession(session) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("session", { audio: session.audio === "system" ? "system" : "off" });
}

function clearFirstFrameTimer() {
  if (firstFrameTimer) clearTimeout(firstFrameTimer);
  firstFrameTimer = undefined;
}

function armFirstFrameTimer(descriptor) {
  clearFirstFrameTimer();
  firstFrameTimer = setTimeout(() => {
    if (closingSession || activeDescriptor?.sessionId !== descriptor.sessionId) return;
    sendStatus("error", "O computador remoto conectou, mas nao enviou video em 20s. Verifique o FFmpeg e atualize o inventario.");
  }, 20_000);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validInput(value) {
  if (!value || typeof value !== "object") return false;
  if (value.type === "mouse.relative") return isFiniteNumber(value.dx) && isFiniteNumber(value.dy);
  if (value.type === "mouse.wheel") return isFiniteNumber(value.delta);
  if (value.type === "mouse.button") {
    return ["left", "middle", "right"].includes(value.button) && ["down", "up"].includes(value.action);
  }
  if (value.type === "key") {
    return Number.isInteger(value.scanCode) && value.scanCode >= 1 && value.scanCode <= 255 &&
      ["down", "up"].includes(value.action) && (value.extended === undefined || typeof value.extended === "boolean");
  }
  return false;
}

async function startSession() {
  const descriptorPath = parseArgs(process.argv.slice(1));
  try {
    const descriptor = await readDescriptor(descriptorPath);
    activeDescriptor = descriptor;
    sendSession(descriptor);
    closingSession = false;
    reconnectAttempt = 0;
    const apiUrl = normalizeEndpoint(descriptor.apiUrl || process.env.REMOTO_API_URL, "api");
    const realtimeUrl = normalizeEndpoint(descriptor.realtimeUrl || process.env.REMOTO_REALTIME_URL, "realtime");
    await consumeSession(descriptor, apiUrl);
    await removeDescriptor(descriptorPath);
    const transportModule = app.isPackaged
      ? pathToFileURL(path.join(app.getAppPath(), "build", "desktop-control.mjs")).href
      : "@remoto/desktop-control/operator";
    sessionModule = sessionModule || await import(transportModule);
    sendStatus("connecting", "Autenticando a sessao...");
    await connectNativeSession(descriptor, realtimeUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendStatus("error", message);
  }
}

async function connectNativeSession(descriptor, realtimeUrl) {
  if (closingSession || activeDescriptor?.sessionId !== descriptor.sessionId) return;
  let firstFrameReceived = false;
  try {
    nativeSession = await sessionModule.openNativeOperatorSession(descriptor, {
      url: realtimeUrl,
      onFrame(frame) {
        if (!firstFrameReceived) {
          firstFrameReceived = true;
          clearFirstFrameTimer();
          sendStatus("connected", "Video recebido.");
        }
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send("video-frame", Uint8Array.from(frame));
      },
      onReady(peerConnected) {
        reconnectAttempt = 0;
        if (peerConnected) armFirstFrameTimer(descriptor);
        else clearFirstFrameTimer();
        sendStatus(peerConnected ? "connected" : "waiting", peerConnected ? "Computador remoto conectado." : "Aguardando o agente remoto...");
      },
      onLatencyMs(latencyMs) {
        sendMetrics({ latencyMs });
      },
      onMetrics(metrics) {
        sendMetrics(metrics);
      },
      onClosed(reason) {
        clearFirstFrameTimer();
        if (closingSession || activeDescriptor?.sessionId !== descriptor.sessionId) return;
        nativeSession = undefined;
        if (isTerminalSessionReason(reason)) {
          sendStatus("closed", reason);
          return;
        }
        scheduleReconnect(descriptor, realtimeUrl, reason);
      }
    });
  } catch (error) {
    clearFirstFrameTimer();
    const message = error instanceof Error ? error.message : String(error);
    if (closingSession || activeDescriptor?.sessionId !== descriptor.sessionId) return;
    scheduleReconnect(descriptor, realtimeUrl, message);
  }
}

function isTerminalSessionReason(reason) {
  return new Set(["session-ended", "session-expired", "session-revoked", "channel-not-authorized", "invalid-session-token"])
    .has(String(reason).toLowerCase());
}

function scheduleReconnect(descriptor, realtimeUrl, reason) {
  if (closingSession || reconnectTimer || reconnectAttempt >= 8) {
    if (reconnectAttempt >= 8) sendStatus("error", "Nao foi possivel reconectar ao computador.");
    return;
  }
  const delay = Math.min(15_000, 500 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  sendStatus("connecting", `${reason}. Tentando reconectar em ${Math.ceil(delay / 1000)}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void connectNativeSession(descriptor, realtimeUrl);
  }, delay);
}

async function closeSession() {
  closingSession = true;
  clearFirstFrameTimer();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  reconnectAttempt = 0;
  const session = nativeSession;
  const descriptor = activeDescriptor;
  nativeSession = undefined;
  if (session) session.close();
  if (!descriptor) return;
  try {
    const apiUrl = normalizeEndpoint(descriptor.apiUrl || process.env.REMOTO_API_URL, "api");
    await fetch(`${apiUrl}/desktop-sessions/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: descriptor.accessToken }),
      signal: AbortSignal.timeout(3_000)
    });
  } catch {
    // Socket closure remains the local fallback if the API is unavailable.
  } finally {
    activeDescriptor = undefined;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#071217",
    title: "Remoto | Sessao de jogo",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  ipcMain.on("input", (_event, value) => {
    if (!nativeSession || !validInput(value)) return;
    try {
      nativeSession.sendInput(value);
    } catch (error) {
      sendStatus("error", error instanceof Error ? error.message : String(error));
    }
  });
  ipcMain.on("close-session", () => void closeSession());

  await mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  void startSession();
  mainWindow.on("closed", () => {
    void closeSession();
    mainWindow = undefined;
  });
}

app.whenReady().then(() => createWindow()).catch((error) => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  void closeSession().finally(() => app.quit());
});

