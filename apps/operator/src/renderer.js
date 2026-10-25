const video = document.getElementById("video");
const stage = document.getElementById("stage");
const empty = document.getElementById("empty");
const emptyTitle = document.getElementById("empty-title");
const detail = document.getElementById("detail");
const errorBox = document.getElementById("error");
const statusText = document.getElementById("status");
const statusDot = document.getElementById("status-dot");
const fpsText = document.getElementById("fps");
const latencyText = document.getElementById("latency");
const firstFrameText = document.getElementById("first-frame");
const receivedText = document.getElementById("received");
const dropsText = document.getElementById("drops");
const frameQueue = [];
let mediaStarted = false;
let frameCount = 0;
let fpsTimer;
let sourceBuffer;
let mediaSource;
let queuedBytes = 0;
let droppedFrames = 0;
const pressedKeys = new Set();
const pressedButtons = new Set();

const mouseButtons = ["left", "middle", "right"];
const scanCodes = {
  Escape: 1, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11,
  Minus: 12, Equal: 13, Backspace: 14, Tab: 15, KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20, KeyY: 21,
  KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25, BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38, Semicolon: 39,
  Quote: 40, Backquote: 41, ShiftLeft: 42, Backslash: 43, KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48,
  KeyN: 49, KeyM: 50, Comma: 51, Period: 52, Slash: 53, ShiftRight: 54, NumpadMultiply: 55, AltLeft: 56,
  Space: 57, CapsLock: 58, F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67,
  F10: 68, NumLock: 69, ScrollLock: 70, Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74,
  Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78, Numpad1: 79, Numpad2: 80, Numpad3: 81,
  Numpad0: 82, NumpadDecimal: 83, F11: 87, F12: 88, ControlRight: 157, AltRight: 184,
  ArrowUp: 72, ArrowDown: 80, ArrowLeft: 75, ArrowRight: 77, Home: 71, End: 79, PageUp: 73,
  PageDown: 81, Insert: 82, Delete: 83, NumpadEnter: 28, NumpadDivide: 53, ContextMenu: 93, PrintScreen: 55
};
const extendedScanCodes = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Insert", "Delete", "Home", "End", "PageUp", "PageDown", "NumpadEnter", "NumpadDivide", "ContextMenu", "PrintScreen"]);

function setStatus(value) {
  const labels = { connecting: "Conectando", waiting: "Aguardando o remoto", connected: "Conectado", closed: "Sessao encerrada", error: "Falha na sessao" };
  statusText.textContent = labels[value] || value;
  statusDot.className = `dot ${value}`;
}

function showDetail(title, message, isError = false) {
  emptyTitle.textContent = title;
  detail.textContent = message;
  empty.classList.toggle("hidden", !isError && title === "Video conectado");
  errorBox.hidden = !isError;
  errorBox.textContent = isError ? message : "";
}

function startMedia(withAudio = false) {
  const mime = window.MediaSource && window.remotoMedia?.selectH264Mime((value) => MediaSource.isTypeSupported(value), withAudio);
  if (!mime) {
    throw new Error("Este computador nao disponibilizou decodificacao H.264 para a sessao.");
  }
  mediaSource = new MediaSource();
  video.src = URL.createObjectURL(mediaSource);
  mediaSource.addEventListener("sourceopen", () => {
    sourceBuffer = mediaSource.addSourceBuffer(mime);
    sourceBuffer.mode = "sequence";
    sourceBuffer.addEventListener("updateend", pumpFrames);
    pumpFrames();
  }, { once: true });
}

function pumpFrames() {
  if (!sourceBuffer || sourceBuffer.updating || frameQueue.length === 0) return;
  if (!keepNearLiveEdge()) return;
  const frame = frameQueue.shift();
  queuedBytes -= frame.byteLength;
  try { sourceBuffer.appendBuffer(frame); } catch (error) { fail(error); }
}

function keepNearLiveEdge() {
  if (!sourceBuffer || sourceBuffer.updating || !video.buffered.length) return true;
  const start = video.buffered.start(0);
  const end = video.buffered.end(video.buffered.length - 1);
  if (end - start > 8) {
    sourceBuffer.remove(start, Math.max(start, end - 4));
    return false;
  }
  if (video.currentTime < start || end - video.currentTime > 1.25) {
    video.currentTime = Math.max(start, end - 0.35);
  }
  return true;
}

function receiveFrame(value) {
  const frame = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (!frame.byteLength) return;
  frameCount += 1;
  frameQueue.push(frame);
  queuedBytes += frame.byteLength;
  while (queuedBytes > 16 * 1024 * 1024 && frameQueue.length > 1) {
    queuedBytes -= frameQueue.shift().byteLength;
    droppedFrames += 1;
  }
  empty.classList.add("hidden");
  pumpFrames();
}

fpsTimer = window.setInterval(() => {
  fpsText.textContent = `${frameCount} FPS`;
  frameCount = 0;
  dropsText.textContent = `fila ${droppedFrames}`;
}, 1000);

function send(event) { window.remotoOperator.sendInput(event); }
function sendKey(event, action) {
  const scanCode = scanCodes[event.code];
  if (!scanCode) return;
  event.preventDefault();
  if (action === "down") pressedKeys.add(event.code); else pressedKeys.delete(event.code);
  send({ type: "key", scanCode, action, ...(extendedScanCodes.has(event.code) ? { extended: true } : {}) });
}
function releaseInputs() {
  for (const button of pressedButtons) send({ type: "mouse.button", button, action: "up" });
  pressedButtons.clear();
  for (const code of pressedKeys) {
    if (scanCodes[code]) send({ type: "key", scanCode: scanCodes[code], action: "up", ...(extendedScanCodes.has(code) ? { extended: true } : {}) });
  }
  pressedKeys.clear();
}
function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  setStatus("error");
  showDetail("Nao foi possivel iniciar o video", message, true);
}

video.addEventListener("click", () => { video.focus(); video.requestPointerLock?.(); });
video.addEventListener("contextmenu", (event) => event.preventDefault());
video.addEventListener("mousemove", (event) => send({ type: "mouse.relative", dx: event.movementX, dy: event.movementY }));
video.addEventListener("mousedown", (event) => { const button = mouseButtons[event.button] || "left"; pressedButtons.add(button); send({ type: "mouse.button", button, action: "down" }); });
video.addEventListener("mouseup", (event) => { const button = mouseButtons[event.button] || "left"; pressedButtons.delete(button); send({ type: "mouse.button", button, action: "up" }); });
video.addEventListener("wheel", (event) => { event.preventDefault(); send({ type: "mouse.wheel", delta: Math.round(event.deltaY * -1) }); }, { passive: false });
video.addEventListener("keydown", (event) => sendKey(event, "down"));
video.addEventListener("keyup", (event) => sendKey(event, "up"));
window.addEventListener("blur", releaseInputs);
document.addEventListener("visibilitychange", releaseInputs);
document.addEventListener("pointerlockchange", () => { if (document.pointerLockElement !== video) releaseInputs(); });
document.getElementById("close").addEventListener("click", () => window.remotoOperator.closeSession());
window.remotoOperator.onStatus(({ status, detail: message }) => {
  setStatus(status);
  if (status === "closed") {
    window.clearInterval(fpsTimer);
    fpsText.textContent = "0 FPS";
  }
  if (status === "error") showDetail("Sessao indisponivel", message, true);
  else if (status === "closed") showDetail("Sessao encerrada", message);
  else detail.textContent = message || detail.textContent;
});
window.remotoOperator.onMetrics(({ latencyMs, latencyP95Ms, firstFrameMs, bytesReceived }) => {
  if (Number.isFinite(latencyMs)) {
    const p95 = Number.isFinite(latencyP95Ms) ? ` / p95 ${Math.round(latencyP95Ms)} ms` : "";
    latencyText.textContent = `RTT ${Math.round(latencyMs)} ms${p95}`;
  }
  if (Number.isFinite(firstFrameMs)) firstFrameText.textContent = `1o frame ${Math.round(firstFrameMs)} ms`;
  if (Number.isFinite(bytesReceived)) receivedText.textContent = `${(bytesReceived / 1024 / 1024).toFixed(1)} MB`;
});
window.remotoOperator.onSession(({ audio }) => {
  if (mediaStarted) return;
  mediaStarted = true;
  try { startMedia(audio === "system"); } catch (error) { fail(error); }
});
window.remotoOperator.onFrame(receiveFrame);
