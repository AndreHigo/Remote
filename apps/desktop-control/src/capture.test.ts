import assert from "node:assert/strict";
import test from "node:test";
import { buildWindowsCaptureArgs, selectCaptureEncoder, selectCaptureMethod } from "./capture.js";

test("captura usa CPU e baixa latencia por padrao acessivel", () => {
  const args = buildWindowsCaptureArgs({ quality: "low", encoder: "cpu" });

  assert.deepEqual(args.slice(0, 13), [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-f", "gdigrab", "-framerate", "30",
    "-draw_mouse", "1", "-i", "desktop", "-an"
  ]);
  assert.ok(args.includes("libx264"));
  assert.ok(args.includes("zerolatency"));
  assert.ok(args.includes("frag_keyframe+empty_moov+default_base_moof"));
  assert.ok(args.includes("-flush_packets"));
  assert.ok(args.includes("mp4"));
  assert.ok(args.includes("-g"));
  assert.ok(args.includes("15"));
});

test("captura pode priorizar encoder de GPU sem quebrar fallback de perfil", () => {
  const args = buildWindowsCaptureArgs({ quality: "high", encoder: "nvidia", width: 1920, height: 1080 });

  assert.ok(args.includes("h264_nvenc"));
  assert.ok(args.includes("scale=1920:1080:force_original_aspect_ratio=decrease"));
  assert.ok(args.includes("60"));
});

test("captura pode usar Desktop Duplication para jogos em tela cheia", () => {
  const args = buildWindowsCaptureArgs({ quality: "balanced", encoder: "cpu" }, "ddagrab");

  assert.deepEqual(args.slice(0, 8), [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-f", "lavfi", "-i", "ddagrab=framerate=60:draw_mouse=1"
  ]);
  assert.ok(!args.includes("gdigrab"));
});

test("audio do sistema usa WASAPI loopback somente quando solicitado", () => {
  const args = buildWindowsCaptureArgs({ quality: "balanced", encoder: "cpu", audio: "system" });

  assert.ok(args.includes("wasapi"));
  assert.ok(args.includes("-loopback"));
  assert.ok(args.includes("-map"));
  assert.ok(args.includes("1:a:0"));
  assert.ok(args.includes("aac"));
  assert.ok(!args.includes("-an"));
});

test("metodo auto usa ddagrab quando a build do FFmpeg oferece o filtro", () => {
  assert.equal(selectCaptureMethod("auto", ["ddagrab"]), "ddagrab");
  assert.equal(selectCaptureMethod("auto", []), "gdigrab");
  assert.equal(selectCaptureMethod("ddagrab", []), "gdigrab");
});

test("metodo auto prioriza gdigrab quando a captura usa CPU", () => {
  assert.equal(selectCaptureMethod("auto", ["ddagrab"], "cpu"), "gdigrab");
  assert.equal(selectCaptureMethod("auto", ["ddagrab"], "nvidia"), "ddagrab");
  assert.equal(selectCaptureMethod("ddagrab", ["ddagrab"], "cpu"), "ddagrab");
});

test("perfil auto escolhe a primeira aceleracao disponivel", () => {
  assert.equal(selectCaptureEncoder("auto", ["h264_qsv", "h264_nvenc"]), "nvidia");
  assert.equal(selectCaptureEncoder("auto", ["h264_amf"]), "amd");
  assert.equal(selectCaptureEncoder("auto", []), "cpu");
});

test("encoder de GPU solicitado cai para CPU quando nao existe na build", () => {
  assert.equal(selectCaptureEncoder("nvidia", ["h264_qsv"]), "cpu");
  assert.equal(selectCaptureEncoder("intel", ["h264_qsv"]), "intel");
});
