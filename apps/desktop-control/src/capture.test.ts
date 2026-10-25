import assert from "node:assert/strict";
import test from "node:test";
import { buildWindowsCaptureArgs } from "./capture.js";

test("captura usa CPU e baixa latencia por padrao acessivel", () => {
  const args = buildWindowsCaptureArgs({ quality: "low", encoder: "cpu" });

  assert.deepEqual(args.slice(0, 12), [
    "-hide_banner", "-loglevel", "error", "-f", "gdigrab", "-framerate", "30",
    "-draw_mouse", "1", "-i", "desktop", "-an"
  ]);
  assert.ok(args.includes("libx264"));
  assert.ok(args.includes("zerolatency"));
  assert.ok(args.includes("frag_keyframe+empty_moov+default_base_moof"));
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
