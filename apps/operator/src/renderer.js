const video = document.getElementById("video");
const stage = document.getElementById("stage");
const empty = document.getElementById("empty");
const emptyTitle = document.getElementById("empty-title");
const detail = document.getElementById("detail");
const errorBox = document.getElementById("error");
const errorMessage = document.getElementById("error-message");
const retryButton = document.getElementById("retry");
const statusText = document.getElementById("status");
const statusDot = document.getElementById("status-dot");
const fpsText = document.getElementById("fps");
const latencyText = document.getElementById("latency");
const firstFrameText = document.getElementById("first-frame");
const receivedText = document.getElementById("received");
const dropsText = document.getElementById("drops");
const gamepadStatus = document.getElementById("gamepad-status");
const reportButton = document.getElementById("report");
const frameQueue = [];
let mediaStarted = false;
let videoFrameCount = 0;
let videoTrackId;
let fpsTimer;
let sourceBuffer;
let mediaSource;
let queuedBytes = 0;
let droppedFrames = 0;
let currentFps = 0;
let qualityState = {
  sessionId: null,
  deviceId: null,
  mode: null,
  startedAt: 0,
  firstFrameMs: null,
  latestRttMs: null,
  latencyP95Ms: null,
  latencySamplesMs: [],
  framesReceived: 0,
  bytesReceived: 0,
  relayDroppedFrames: 0,
  relayDroppedBytes: 0,
  reconnects: 0,
  connectedOnce: false
};
const pressedKeys = new Set();
const pressedButtons = new Set();
const pressedGamepadKeys = new Set();
let pendingMouseMotion = { dx: 0, dy: 0 };
let mouseMotionFrame;

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
  errorMessage.textContent = isError ? message : "";
  retryButton.hidden = !isError;
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
  videoTrackId ??= findVideoTrackId(frame);
  videoFrameCount += countVideoSamples(frame, videoTrackId);
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
  currentFps = videoFrameCount;
  fpsText.textContent = `${currentFps} FPS`;
  videoFrameCount = 0;
  dropsText.textContent = `fila ${droppedFrames}`;
}, 1000);

function send(event) { window.remotoOperator.sendInput(event); }
function queueMouseMotion(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  pendingMouseMotion.dx += dx;
  pendingMouseMotion.dy += dy;
  if (mouseMotionFrame !== undefined) return;
  mouseMotionFrame = window.requestAnimationFrame(() => {
    mouseMotionFrame = undefined;
    const motion = pendingMouseMotion;
    pendingMouseMotion = { dx: 0, dy: 0 };
    const nextDx = Math.round(motion.dx);
    const nextDy = Math.round(motion.dy);
    if (nextDx !== 0 || nextDy !== 0) send({ type: "mouse.relative", dx: nextDx, dy: nextDy });
  });
}
function sendKey(event, action) {
  const scanCode = scanCodes[event.code];
  if (!scanCode) return;
  event.preventDefault();
  if (action === "down") {
    pressedKeys.add(event.code);
    if (!pressedGamepadKeys.has(event.code)) send({ type: "key", scanCode, action, ...(extendedScanCodes.has(event.code) ? { extended: true } : {}) });
  } else {
    pressedKeys.delete(event.code);
    if (!pressedGamepadKeys.has(event.code)) send({ type: "key", scanCode, action, ...(extendedScanCodes.has(event.code) ? { extended: true } : {}) });
  }
}
function releaseInputs() {
  if (mouseMotionFrame !== undefined) window.cancelAnimationFrame(mouseMotionFrame);
  mouseMotionFrame = undefined;
  pendingMouseMotion = { dx: 0, dy: 0 };
  for (const button of pressedButtons) send({ type: "mouse.button", button, action: "up" });
  pressedButtons.clear();
  for (const code of new Set([...pressedKeys, ...pressedGamepadKeys])) {
    if (scanCodes[code]) send({ type: "key", scanCode: scanCodes[code], action: "up", ...(extendedScanCodes.has(code) ? { extended: true } : {}) });
  }
  pressedKeys.clear();
  pressedGamepadKeys.clear();
}

const gamepadButtonScanCodes = new Map([
  [0, "Space"], [1, "Escape"], [2, "KeyR"], [3, "KeyE"], [4, "KeyQ"], [5, "KeyF"],
  [6, "ShiftLeft"], [7, "ControlLeft"], [8, "Backspace"], [9, "Enter"], [10, "AltLeft"], [11, "Tab"],
  [12, "ArrowUp"], [13, "ArrowDown"], [14, "ArrowLeft"], [15, "ArrowRight"]
]);
function setGamepadKey(code, down) {
  const scanCode = scanCodes[code];
  if (!scanCode) return;
  if (down) {
    if (pressedGamepadKeys.has(code)) return;
    pressedGamepadKeys.add(code);
    if (!pressedKeys.has(code)) send({ type: "key", scanCode, action: "down", ...(extendedScanCodes.has(code) ? { extended: true } : {}) });
  } else if (pressedGamepadKeys.delete(code) && !pressedKeys.has(code)) {
    send({ type: "key", scanCode, action: "up", ...(extendedScanCodes.has(code) ? { extended: true } : {}) });
  }
}
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pad = Array.from(navigator.getGamepads()).find((candidate) => candidate?.connected);
  if (!pad) {
    if (gamepadStatus) gamepadStatus.textContent = "Gamepad: conecte um controle";
    for (const code of [...pressedGamepadKeys]) setGamepadKey(code, false);
    return;
  }
  if (gamepadStatus) gamepadStatus.textContent = "Gamepad: mapa experimental";
  const deadZone = 0.24;
  const leftX = pad.axes[0] || 0;
  const leftY = pad.axes[1] || 0;
  setGamepadKey("KeyA", leftX < -deadZone);
  setGamepadKey("KeyD", leftX > deadZone);
  setGamepadKey("KeyW", leftY < -deadZone);
  setGamepadKey("KeyS", leftY > deadZone);
  const rightX = pad.axes[2] || 0;
  const rightY = pad.axes[3] || 0;
  if (Math.abs(rightX) > deadZone || Math.abs(rightY) > deadZone) queueMouseMotion(rightX * 18, rightY * 18);
  for (const [index, code] of gamepadButtonScanCodes) setGamepadKey(code, pad.buttons[index]?.pressed === true);
}
const gamepadTimer = window.setInterval(pollGamepad, 33);
pollGamepad();
function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  setStatus("error");
  showDetail("Nao foi possivel iniciar o video", message, true);
}

video.addEventListener("click", () => { video.focus(); video.requestPointerLock?.(); });
video.addEventListener("contextmenu", (event) => event.preventDefault());
video.addEventListener("mousemove", (event) => queueMouseMotion(event.movementX, event.movementY));
video.addEventListener("mousedown", (event) => { const button = mouseButtons[event.button] || "left"; pressedButtons.add(button); send({ type: "mouse.button", button, action: "down" }); });
video.addEventListener("mouseup", (event) => { const button = mouseButtons[event.button] || "left"; pressedButtons.delete(button); send({ type: "mouse.button", button, action: "up" }); });
video.addEventListener("wheel", (event) => { event.preventDefault(); send({ type: "mouse.wheel", delta: Math.round(event.deltaY * -1) }); }, { passive: false });
video.addEventListener("keydown", (event) => sendKey(event, "down"));
video.addEventListener("keyup", (event) => sendKey(event, "up"));
window.addEventListener("blur", releaseInputs);
document.addEventListener("visibilitychange", releaseInputs);
document.addEventListener("pointerlockchange", () => { if (document.pointerLockElement !== video) releaseInputs(); });
window.addEventListener("beforeunload", () => {
  window.clearInterval(gamepadTimer);
  if (mouseMotionFrame !== undefined) window.cancelAnimationFrame(mouseMotionFrame);
  mouseMotionFrame = undefined;
  pendingMouseMotion = { dx: 0, dy: 0 };
});

function readMp4Boxes(buffer, type, start = 0, end = buffer.byteLength) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    const declaredSize = view.getUint32(offset);
    const headerSize = declaredSize === 1 ? 16 : 8;
    if (offset + headerSize > end) break;
    const byteLength = declaredSize === 1 ? Number(view.getBigUint64(offset + 8)) : declaredSize;
    if (!Number.isSafeInteger(byteLength) || byteLength < headerSize || offset + byteLength > end) break;
    const boxType = String.fromCharCode(...buffer.subarray(offset + 4, offset + 8));
    if (type === undefined || boxType === type) boxes.push({ payloadStart: offset + headerSize, end: offset + byteLength });
    offset += byteLength;
  }
  return boxes;
}

function findMp4BoxDeep(buffer, type, start, end) {
  const direct = readMp4Boxes(buffer, type, start, end)[0];
  if (direct) return direct;
  for (const box of readMp4Boxes(buffer, undefined, start, end)) {
    const nested = findMp4BoxDeep(buffer, type, box.payloadStart, box.end);
    if (nested) return nested;
  }
}

function findVideoTrackId(segment) {
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  for (const moov of readMp4Boxes(segment, "moov")) {
    for (const trak of readMp4Boxes(segment, "trak", moov.payloadStart, moov.end)) {
      const handler = findMp4BoxDeep(segment, "hdlr", trak.payloadStart, trak.end);
      if (!handler || String.fromCharCode(...segment.subarray(handler.payloadStart + 8, handler.payloadStart + 12)) !== "vide") continue;
      const tkhd = readMp4Boxes(segment, "tkhd", trak.payloadStart, trak.end)[0];
      if (!tkhd || tkhd.payloadStart + 16 > tkhd.end) continue;
      const trackIdOffset = view.getUint8(tkhd.payloadStart) === 1 ? tkhd.payloadStart + 20 : tkhd.payloadStart + 12;
      if (trackIdOffset + 4 <= tkhd.end) return view.getUint32(trackIdOffset);
    }
  }
}

function countVideoSamples(segment, expectedTrackId) {
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  const counts = [];
  for (const moof of readMp4Boxes(segment, "moof")) {
    for (const traf of readMp4Boxes(segment, "traf", moof.payloadStart, moof.end)) {
      const tfhd = readMp4Boxes(segment, "tfhd", traf.payloadStart, traf.end)[0];
      const trackId = tfhd && tfhd.payloadStart + 8 <= tfhd.end ? view.getUint32(tfhd.payloadStart + 4) : undefined;
      if (expectedTrackId !== undefined && trackId !== expectedTrackId) continue;
      for (const trun of readMp4Boxes(segment, "trun", traf.payloadStart, traf.end)) {
        if (trun.payloadStart + 8 <= trun.end) counts.push(view.getUint32(trun.payloadStart + 4));
      }
    }
  }
  return counts.length ? Math.max(...counts) : 0;
}
document.getElementById("close").addEventListener("click", () => window.remotoOperator.closeSession());
window.remotoOperator.onStatus(({ status, detail: message }) => {
  if (status === "connecting" && qualityState.connectedOnce) qualityState.reconnects += 1;
  if (status === "connected") qualityState.connectedOnce = true;
  setStatus(status);
  if (status === "closed") {
    window.clearInterval(fpsTimer);
    fpsText.textContent = "0 FPS";
  }
  if (status === "error") showDetail("Sessao indisponivel", message, true);
  else if (status === "closed") showDetail("Sessao encerrada", message);
  else {
    retryButton.hidden = true;
    detail.textContent = message || detail.textContent;
  }
});
window.remotoOperator.onMetrics(({ latencyMs, latencyP95Ms, firstFrameMs, framesReceived, bytesReceived, relayDroppedFrames, relayDroppedBytes }) => {
  if (Number.isFinite(framesReceived)) qualityState.framesReceived = Math.max(0, Math.floor(framesReceived));
  if (Number.isFinite(bytesReceived)) qualityState.bytesReceived = Math.max(0, Math.floor(bytesReceived));
  if (Number.isFinite(latencyMs)) {
    qualityState.latestRttMs = Math.max(0, latencyMs);
    qualityState.latencySamplesMs.push(Math.max(0, latencyMs));
    qualityState.latencySamplesMs = qualityState.latencySamplesMs.slice(-120);
    const p95 = Number.isFinite(latencyP95Ms) ? ` / p95 ${Math.round(latencyP95Ms)} ms` : "";
    latencyText.textContent = `RTT ${Math.round(latencyMs)} ms${p95}`;
  }
  if (Number.isFinite(latencyP95Ms)) qualityState.latencyP95Ms = Math.max(0, latencyP95Ms);
  if (Number.isFinite(firstFrameMs)) {
    qualityState.firstFrameMs = Math.max(0, firstFrameMs);
    firstFrameText.textContent = `1o frame ${Math.round(firstFrameMs)} ms`;
  }
  if (Number.isFinite(bytesReceived)) receivedText.textContent = `${(bytesReceived / 1024 / 1024).toFixed(1)} MB`;
  if (Number.isFinite(relayDroppedFrames)) qualityState.relayDroppedFrames = Math.max(0, Math.floor(relayDroppedFrames));
  if (Number.isFinite(relayDroppedBytes)) qualityState.relayDroppedBytes = Math.max(0, Math.floor(relayDroppedBytes));
  if (Number.isFinite(relayDroppedFrames)) dropsText.textContent = `fila ${droppedFrames} / relay ${Math.round(relayDroppedFrames)}`;
});
window.remotoOperator.onSession(({ audio, sessionId, deviceId, mode }) => {
  qualityState = { ...qualityState, sessionId, deviceId, mode, startedAt: Date.now(), connectedOnce: false };
  videoFrameCount = 0;
  videoTrackId = undefined;
  reportButton.disabled = false;
  if (mediaStarted) return;
  mediaStarted = true;
  try { startMedia(audio === "system"); } catch (error) { fail(error); }
});
window.remotoOperator.onFrame(receiveFrame);
retryButton.addEventListener("click", () => {
  retryButton.hidden = true;
  showDetail("Reconectando", "Tentando restabelecer o canal com o computador remoto.");
  window.remotoOperator.retrySession();
});
reportButton.addEventListener("click", async () => {
  if (!qualityState.startedAt) return;
  reportButton.disabled = true;
  try {
    const result = await window.remotoOperator.saveQualityReport({
      ...qualityState,
      generatedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - qualityState.startedAt),
      currentFps,
      droppedLocalFrames: droppedFrames
    });
    if (result?.saved) detail.textContent = `Relatorio salvo em ${result.filePath}`;
  } catch (error) {
    detail.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    reportButton.disabled = false;
  }
});
