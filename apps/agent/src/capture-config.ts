import type { CaptureProfile, VideoEncoder, VideoQuality } from "@remoto/desktop-control/capture";

export interface CaptureConfigValues {
  captureQuality?: string;
  captureEncoder?: string;
  captureWidth?: number | string;
  captureHeight?: number | string;
  captureFps?: number | string;
  captureBitrateKbps?: number | string;
}

export interface CaptureReadiness {
  gameModeReady: boolean;
  ffmpegAvailable: boolean;
  encoder: VideoEncoder;
  quality: VideoQuality;
  width?: number;
  height?: number;
  fps?: number;
  bitrateKbps?: number;
  cpuFallback: boolean;
}

const qualities = new Set<VideoQuality>(["auto", "low", "balanced", "high"]);
const encoders = new Set<VideoEncoder>(["auto", "cpu", "nvidia", "amd", "intel"]);

export function readCaptureProfile(fileConfig: CaptureConfigValues, environment: NodeJS.ProcessEnv = process.env): CaptureProfile {
  const quality = readEnum(environment.REMOTO_CAPTURE_QUALITY ?? fileConfig.captureQuality, qualities, "auto", "REMOTO_CAPTURE_QUALITY");
  const encoder = readEnum(environment.REMOTO_CAPTURE_ENCODER ?? fileConfig.captureEncoder, encoders, "cpu", "REMOTO_CAPTURE_ENCODER");

  return {
    quality,
    encoder,
    width: readOptionalPositive(environment.REMOTO_CAPTURE_WIDTH ?? fileConfig.captureWidth, "REMOTO_CAPTURE_WIDTH"),
    height: readOptionalPositive(environment.REMOTO_CAPTURE_HEIGHT ?? fileConfig.captureHeight, "REMOTO_CAPTURE_HEIGHT"),
    fps: readOptionalPositive(environment.REMOTO_CAPTURE_FPS ?? fileConfig.captureFps, "REMOTO_CAPTURE_FPS", 120),
    bitrateKbps: readOptionalPositive(environment.REMOTO_CAPTURE_BITRATE_KBPS ?? fileConfig.captureBitrateKbps, "REMOTO_CAPTURE_BITRATE_KBPS", 100_000)
  };
}

export function buildCaptureReadiness(profile: CaptureProfile, ffmpegAvailable: boolean): CaptureReadiness {
  return {
    gameModeReady: ffmpegAvailable,
    ffmpegAvailable,
    encoder: profile.encoder,
    quality: profile.quality,
    width: profile.width,
    height: profile.height,
    fps: profile.fps,
    bitrateKbps: profile.bitrateKbps,
    cpuFallback: profile.encoder === "cpu" || profile.quality === "auto"
  };
}

function readEnum<T extends string>(raw: string | undefined, allowed: Set<T>, fallback: T, name: string): T {
  const value = raw?.trim().toLowerCase();
  if (!value) return fallback;
  if (!allowed.has(value as T)) throw new Error(`${name} invalido: ${raw}`);
  return value as T;
}

function readOptionalPositive(raw: number | string | undefined, name: string, max = 16_000) {
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > max) throw new Error(`${name} deve ser um inteiro entre 1 e ${max}`);
  return value;
}
