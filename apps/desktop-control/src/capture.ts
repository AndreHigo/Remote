import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type VideoQuality = "auto" | "low" | "balanced" | "high";
export type VideoEncoder = "cpu" | "nvidia" | "amd" | "intel";

export interface CaptureProfile {
  quality: VideoQuality;
  encoder: VideoEncoder;
  width?: number;
  height?: number;
  fps?: number;
  bitrateKbps?: number;
}

export interface CaptureProcess {
  process: ChildProcessWithoutNullStreams;
  stop(): void;
}

const defaultProfile: Required<Pick<CaptureProfile, "quality" | "encoder">> = {
  quality: "auto",
  encoder: "cpu"
};

export function buildWindowsCaptureArgs(profile: CaptureProfile = defaultProfile) {
  const fps = profile.fps ?? qualityDefaults(profile.quality).fps;
  const bitrateKbps = profile.bitrateKbps ?? qualityDefaults(profile.quality).bitrateKbps;
  const keyframeInterval = Math.max(15, Math.round(fps / 2));
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-f", "gdigrab",
    "-framerate", String(fps),
    "-draw_mouse", "1",
    "-i", "desktop"
  ];

  if (profile.width && profile.height) {
    args.push("-vf", `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease`);
  }

  args.push(
    "-an",
    "-c:v", encoderName(profile.encoder),
    "-preset", profile.encoder === "cpu" ? "ultrafast" : "p1",
    "-tune", "zerolatency",
    "-profile:v", "main",
    "-level", "4.2",
    "-g", String(keyframeInterval),
    "-keyint_min", String(keyframeInterval),
    "-b:v", `${bitrateKbps}k`,
    "-maxrate", `${bitrateKbps}k`,
    "-bufsize", `${bitrateKbps * 2}k`,
    "-pix_fmt", "yuv420p",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4",
    "pipe:1"
  );

  return args;
}

export function startWindowsCapture(profile: CaptureProfile = defaultProfile): CaptureProcess {
  if (process.platform !== "win32") {
    throw new Error("A captura gdigrab esta disponivel apenas no Windows.");
  }

  const executable = process.env.REMOTO_FFMPEG_PATH ?? "ffmpeg.exe";
  const child = spawn(executable, buildWindowsCaptureArgs(profile), {
    stdio: "pipe",
    windowsHide: true
  });

  return {
    process: child,
    stop() {
      if (!child.killed) child.kill();
    }
  };
}

function encoderName(encoder: VideoEncoder) {
  switch (encoder) {
    case "nvidia": return "h264_nvenc";
    case "amd": return "h264_amf";
    case "intel": return "h264_qsv";
    default: return "libx264";
  }
}

function qualityDefaults(quality: VideoQuality) {
  switch (quality) {
    case "low": return { fps: 30, bitrateKbps: 3500 };
    case "high": return { fps: 60, bitrateKbps: 12000 };
    case "balanced": return { fps: 60, bitrateKbps: 7000 };
    default: return { fps: 60, bitrateKbps: 6000 };
  }
}
