import assert from "node:assert/strict";
import test from "node:test";
import { buildCaptureReadiness, readCaptureProfile } from "./capture-config.js";

test("usa CPU e perfil auto como padrao acessivel", () => {
  assert.deepEqual(readCaptureProfile({}), { quality: "auto", encoder: "cpu", width: undefined, height: undefined, fps: undefined, bitrateKbps: undefined });
});

test("permite configurar perfil e limites pelo ambiente", () => {
  const profile = readCaptureProfile({}, {
    REMOTO_CAPTURE_QUALITY: "balanced",
    REMOTO_CAPTURE_ENCODER: "intel",
    REMOTO_CAPTURE_WIDTH: "1920",
    REMOTO_CAPTURE_HEIGHT: "1080",
    REMOTO_CAPTURE_FPS: "60",
    REMOTO_CAPTURE_BITRATE_KBPS: "8000"
  });
  assert.deepEqual(profile, { quality: "balanced", encoder: "intel", width: 1920, height: 1080, fps: 60, bitrateKbps: 8000 });
});

test("permite deixar o encoder em modo automatico", () => {
  assert.equal(readCaptureProfile({ captureEncoder: "auto" }).encoder, "auto");
});

test("rejeita perfil e limites invalidos", () => {
  assert.throws(() => readCaptureProfile({ captureQuality: "ultra" }), /REMOTO_CAPTURE_QUALITY/);
  assert.throws(() => readCaptureProfile({}, { REMOTO_CAPTURE_FPS: "121" }), /REMOTO_CAPTURE_FPS/);
});

test("expõe prontidao do modo jogo sem esconder o fallback de CPU", () => {
  const profile = readCaptureProfile({ captureQuality: "balanced", captureEncoder: "cpu", captureFps: "60" });
  assert.deepEqual(buildCaptureReadiness(profile, true), {
    gameModeReady: true,
    ffmpegAvailable: true,
    encoder: "cpu",
    quality: "balanced",
    width: undefined,
    height: undefined,
    fps: 60,
    bitrateKbps: undefined,
    cpuFallback: true
  });
  assert.equal(buildCaptureReadiness(profile, false).gameModeReady, false);
});
