import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type VideoQuality = "auto" | "low" | "balanced" | "high";
export type VideoEncoder = "auto" | "cpu" | "nvidia" | "amd" | "intel";
export type CaptureMethod = "auto" | "gdigrab" | "ddagrab";
export type CaptureAudio = "off" | "system";

export interface CaptureProfile {
  quality: VideoQuality;
  encoder: VideoEncoder;
  audio?: CaptureAudio;
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

export interface FfmpegCapabilities {
  executable: string | null;
  available: boolean;
  videoEncoderAvailable: boolean;
  cpuEncoderAvailable: boolean;
  hardwareEncoders: Array<Exclude<VideoEncoder, "auto" | "cpu">>;
  captureMethods: Array<Exclude<CaptureMethod, "auto">>;
  systemAudioAvailable: boolean;
  selectedEncoder: Exclude<VideoEncoder, "auto">;
  selectedEncoderAvailable: boolean;
  selectedCaptureMethod: Exclude<CaptureMethod, "auto">;
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

  if (profile.audio === "system") {
    args.push("-thread_queue_size", "512", "-f", "wasapi", "-loopback", "1", "-i", "default");
  }

  if (profile.width && profile.height) {
    args.push("-vf", `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease`);
  }

  args.push(
    ...(profile.audio === "system" ? ["-map", "0:v:0", "-map", "1:a:0"] : ["-an"]),
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
    ...(profile.audio === "system" ? ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"] : []),
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
  const selectedMethod = resolveCaptureMethod(profile.captureMethod ?? "auto", executable, selectedEncoder);
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

export function inspectFfmpegCapabilities(preferredPath?: string, profile: CaptureProfile = defaultProfile): FfmpegCapabilities {
  const executable = resolveFfmpegExecutable(preferredPath);
  if (!executable) {
    return {
      executable: null,
      available: false,
      videoEncoderAvailable: false,
      cpuEncoderAvailable: false,
      hardwareEncoders: [],
      captureMethods: [],
      systemAudioAvailable: false,
      selectedEncoder: "cpu",
      selectedEncoderAvailable: false,
      selectedCaptureMethod: "gdigrab"
    };
  }

  const encodersOutput = runFfmpegProbe(executable, ["-hide_banner", "-encoders"]);
  const filtersOutput = runFfmpegProbe(executable, ["-hide_banner", "-filters"]);
  const formatsOutput = runFfmpegProbe(executable, ["-hide_banner", "-formats"]);
  const devicesOutput = runFfmpegProbe(executable, ["-hide_banner", "-devices"]);
  const hardwareEncoders = ([
    ["nvidia", "h264_nvenc"],
    ["amd", "h264_amf"],
    ["intel", "h264_qsv"]
  ] as const)
    .filter(([, name]) => new RegExp(`\\b${name}\\b`).test(encodersOutput))
    .map(([encoder]) => encoder);
  const availableEncoders = [
    ...hardwareEncoders.map((encoder) => encoderName(encoder)),
    ...( /\blibx264\b/.test(encodersOutput) ? ["libx264"] : [])
  ];
  const captureMethods = [
    ...( /(?:^|\s)gdigrab(?:\s|$)/m.test(formatsOutput) ? ["gdigrab" as const] : []),
    ...( /(?:^|\s)ddagrab(?:\s|$)/m.test(filtersOutput) ? ["ddagrab" as const] : [])
  ];
  const systemAudioAvailable = /\bwasapi\b/i.test(`${formatsOutput}\n${devicesOutput}`);
  const cpuEncoderAvailable = availableEncoders.includes("libx264");
  const videoEncoderAvailable = cpuEncoderAvailable || hardwareEncoders.length > 0;
  const selectedEncoder = videoEncoderAvailable
    ? selectCaptureEncoder(profile.encoder, availableEncoders)
    : "cpu";
  const selectedEncoderAvailable = selectedEncoder === "cpu"
    ? cpuEncoderAvailable
    : hardwareEncoders.includes(selectedEncoder);
  const selectedCaptureMethod = captureMethods.length > 0
    ? selectCaptureMethod(profile.captureMethod ?? "auto", captureMethods, selectedEncoder)
    : "gdigrab";

  return {
    executable,
    available: true,
    videoEncoderAvailable,
    cpuEncoderAvailable,
    hardwareEncoders,
    captureMethods,
    systemAudioAvailable,
    selectedEncoder,
    selectedEncoderAvailable,
    selectedCaptureMethod
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

export function selectCaptureMethod(
  requested: CaptureMethod,
  availableFilters: Iterable<string>,
  selectedEncoder?: Exclude<VideoEncoder, "auto">
): Exclude<CaptureMethod, "auto"> {
  const available = new Set(availableFilters);
  if (requested === "gdigrab") return "gdigrab";
  if (requested === "ddagrab") return available.has("ddagrab") ? "ddagrab" : "gdigrab";
  if (selectedEncoder === "cpu") return "gdigrab";
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

function resolveCaptureMethod(
  requested: CaptureMethod,
  executable: string,
  selectedEncoder: Exclude<VideoEncoder, "auto">
): Exclude<CaptureMethod, "auto"> {
  if (requested === "gdigrab") return "gdigrab";
  try {
    const output = execFileSync(executable, ["-hide_banner", "-filters"], {
      encoding: "utf8",
      timeout: 2_000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const available = [...output.matchAll(/(?:^|\s)ddagrab\s+/gm)].map(() => "ddagrab");
    return selectCaptureMethod(requested, available, selectedEncoder);
  } catch {
    return "gdigrab";
  }
}

function runFfmpegProbe(executable: string, args: string[]) {
  try {
    return execFileSync(executable, args, {
      encoding: "utf8",
      timeout: 2_000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };
    return `${output.stdout ?? ""}\n${output.stderr ?? ""}`;
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
