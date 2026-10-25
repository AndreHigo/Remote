import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type VideoQuality = "auto" | "low" | "balanced" | "high";
export type VideoEncoder = "cpu" | "nvidia" | "amd" | "intel";

export interface CaptureProfile {
  quality: VideoQuality;
  encoder: VideoEncoder;
  width?: number;
  height?: number;
  fps?: number;
  bitrateKbps?: number;
  ffmpegPath?: string;
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

  const executable = profile.ffmpegPath ?? process.env.REMOTO_FFMPEG_PATH ?? resolveFfmpegExecutable() ?? "ffmpeg.exe";
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

export function resolveFfmpegExecutable() {
  const candidates = [
    path.join(path.dirname(process.execPath), "ffmpeg.exe"),
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "ffmpeg", "bin", "ffmpeg.exe"),
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "FFmpeg", "bin", "ffmpeg.exe"),
    path.join(process.env.ProgramData ?? "C:\\ProgramData", "chocolatey", "bin", "ffmpeg.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages", "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe", "ffmpeg-8.1.2-full_build", "bin", "ffmpeg.exe")
  ];
  const direct = candidates.find((candidate) => fs.existsSync(candidate));
  if (direct) return direct;

  const roots = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages") : "",
    ...(process.env.SystemDrive ? listWindowsUserPackageRoots(path.join(process.env.SystemDrive, "Users")) : [])
  ].filter(Boolean);
  for (const root of roots) {
    const discovered = findFfmpegInWinGet(root);
    if (discovered) return discovered;
  }
  return null;
}

function listWindowsUserPackageRoots(usersRoot: string) {
  try {
    return fs.readdirSync(usersRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !/^(Default|Public|Default User|All Users)$/i.test(entry.name))
      .map((entry) => path.join(usersRoot, entry.name, "AppData", "Local", "Microsoft", "WinGet", "Packages"));
  } catch {
    return [];
  }
}

function findFfmpegInWinGet(root: string) {
  try {
    const packageRoots = fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /ffmpeg/i.test(entry.name))
      .map((entry) => path.join(root, entry.name));
    for (const packageRoot of packageRoots) {
      const versions = fs.readdirSync(packageRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(packageRoot, entry.name));
      const candidate = versions.map((version) => path.join(version, "bin", "ffmpeg.exe")).find((value) => fs.existsSync(value));
      if (candidate) return candidate;
    }
  } catch {
    // Discovery is best-effort; the caller can still use PATH or an explicit path.
  }
  return null;
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
