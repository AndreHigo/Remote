import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type VideoQuality = "auto" | "low" | "balanced" | "high";
export type VideoEncoder = "auto" | "cpu" | "nvidia" | "amd" | "intel";
export type CaptureMethod = "auto" | "gdigrab" | "ddagrab";

export interface CaptureProfile {
  quality: VideoQuality;
  encoder: VideoEncoder;
  captureMethod?: CaptureMethod;
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
  encoder: "auto"
};

export function buildWindowsCaptureArgs(profile: CaptureProfile = defaultProfile, captureMethod: Exclude<CaptureMethod, "auto"> = "gdigrab") {
  const fps = profile.fps ?? qualityDefaults(profile.quality).fps;
  const bitrateKbps = profile.bitrateKbps ?? qualityDefaults(profile.quality).bitrateKbps;
  const keyframeInterval = Math.max(15, Math.round(fps / 2));
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin"];
  if (captureMethod === "ddagrab") {
    args.push("-f", "lavfi", "-i", `ddagrab=framerate=${fps}:draw_mouse=1`);
  } else {
    args.push("-f", "gdigrab", "-framerate", String(fps), "-draw_mouse", "1", "-i", "desktop");
  }

  if (profile.width && profile.height) {
    args.push("-vf", `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease`);
  }

  args.push(
    "-an",
    "-c:v", encoderName(profile.encoder),
    "-preset", profile.encoder === "cpu" || profile.encoder === "auto" ? "ultrafast" : "p1",
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
    "-flush_packets", "1",
    "-f", "mp4",
    "pipe:1"
  );

  return args;
}

export function startWindowsCapture(profile: CaptureProfile = defaultProfile): CaptureProcess {
  if (process.platform !== "win32") {
    throw new Error("A captura gdigrab esta disponivel apenas no Windows.");
  }

  const resolvedExecutable = resolveFfmpegExecutable(profile.ffmpegPath);
  if (!resolvedExecutable && process.env.REMOTO_AGENT_SERVICE === "1") {
    throw new Error("FFmpeg nao encontrado em um caminho confiavel para o servico.");
  }
  const executable = resolvedExecutable ?? "ffmpeg.exe";
  const selectedEncoder = resolveCaptureEncoder(profile.encoder, executable);
  const selectedMethod = resolveCaptureMethod(profile.captureMethod ?? "auto", executable);
  const child = spawn(executable, buildWindowsCaptureArgs({ ...profile, encoder: selectedEncoder }, selectedMethod), {
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

export function selectCaptureEncoder(requested: VideoEncoder, availableEncoders: Iterable<string>): Exclude<VideoEncoder, "auto"> {
  const available = new Set(availableEncoders);
  if (requested !== "auto" && requested !== "cpu") {
    return available.has(encoderName(requested)) ? requested : "cpu";
  }
  if (requested === "cpu") return "cpu";
  for (const candidate of ["nvidia", "amd", "intel"] as const) {
    if (available.has(encoderName(candidate))) return candidate;
  }
  return "cpu";
}

export function selectCaptureMethod(requested: CaptureMethod, availableFilters: Iterable<string>): Exclude<CaptureMethod, "auto"> {
  const available = new Set(availableFilters);
  if (requested === "gdigrab") return "gdigrab";
  if (requested === "ddagrab") return available.has("ddagrab") ? "ddagrab" : "gdigrab";
  return available.has("ddagrab") ? "ddagrab" : "gdigrab";
}

function resolveCaptureEncoder(requested: VideoEncoder, executable: string): Exclude<VideoEncoder, "auto"> {
  if (requested === "cpu") return "cpu";
  try {
    const output = execFileSync(executable, ["-hide_banner", "-encoders"], {
      encoding: "utf8",
      timeout: 2_000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const available = [...output.matchAll(/\bh264_(?:nvenc|amf|qsv)\b/g)].map((match) => match[0]);
    return selectCaptureEncoder(requested, available);
  } catch {
    return "cpu";
  }
}

function resolveCaptureMethod(requested: CaptureMethod, executable: string): Exclude<CaptureMethod, "auto"> {
  if (requested === "gdigrab") return "gdigrab";
  try {
    const output = execFileSync(executable, ["-hide_banner", "-filters"], {
      encoding: "utf8",
      timeout: 2_000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const available = [...output.matchAll(/(?:^|\s)ddagrab\s+/gm)].map(() => "ddagrab");
    return selectCaptureMethod(requested, available);
  } catch {
    return "gdigrab";
  }
}

export function resolveFfmpegExecutable(preferredPath?: string) {
  const candidates = [
    preferredPath,
    process.env.REMOTO_FFMPEG_PATH,
    path.join(path.dirname(process.execPath), "ffmpeg.exe"),
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "ffmpeg", "bin", "ffmpeg.exe"),
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "FFmpeg", "bin", "ffmpeg.exe"),
    path.join(process.env.ProgramData ?? "C:\\ProgramData", "chocolatey", "bin", "ffmpeg.exe")
  ].filter((candidate): candidate is string => Boolean(candidate));
  const direct = candidates.find((candidate) => isAllowedFfmpegPath(candidate) && fs.existsSync(candidate));
  if (direct) return direct;

  const roots = process.env.ProgramData
    ? [path.join(process.env.ProgramData, "Microsoft", "WinGet", "Packages")]
    : [];
  if (process.env.REMOTO_AGENT_SERVICE !== "1" && process.env.LOCALAPPDATA) {
    roots.push(path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages"));
  }
  for (const root of roots) {
    const discovered = findFfmpegInWinGet(root);
    if (discovered) return discovered;
  }
  return null;
}

function isAllowedFfmpegPath(candidate: string) {
  if (process.env.REMOTO_AGENT_SERVICE !== "1" || process.platform !== "win32") return true;
  const resolved = path.resolve(candidate).toLowerCase();
  const trustedRoots = [
    path.dirname(process.execPath),
    process.env.ProgramFiles ?? "C:\\Program Files",
    process.env.ProgramData ?? "C:\\ProgramData"
  ].map((root) => path.resolve(root).toLowerCase());
  return trustedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
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
    case "auto": return "libx264";
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
