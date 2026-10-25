export type GameCapabilityReason = "inventory-missing" | "inventory-stale" | "capture-not-ready" | "inventory-invalid";

export interface GameCapabilityStatus {
  ready: boolean;
  reason?: GameCapabilityReason;
  audio?: "off" | "system";
}

export function readGameAudio(snapshot: { software: unknown } | null): "off" | "system" {
  if (!snapshot || !snapshot.software || typeof snapshot.software !== "object" || Array.isArray(snapshot.software)) return "off";
  const capture = (snapshot.software as { capture?: unknown }).capture;
  if (!capture || typeof capture !== "object" || Array.isArray(capture)) return "off";
  const captureStatus = capture as { audio?: unknown; systemAudioAvailable?: unknown };
  return captureStatus.audio === "system" && captureStatus.systemAudioAvailable === true ? "system" : "off";
}

const MAX_INVENTORY_AGE_MS = 15 * 60 * 1000;

export function evaluateGameCapability(
  snapshot: { collectedAt: Date | string; software: unknown } | null,
  now = Date.now()
): GameCapabilityStatus {
  if (!snapshot) return { ready: false, reason: "inventory-missing" };

  const collectedAt = snapshot.collectedAt instanceof Date
    ? snapshot.collectedAt.getTime()
    : Date.parse(snapshot.collectedAt);
  if (!Number.isFinite(collectedAt) || collectedAt > now || now - collectedAt > MAX_INVENTORY_AGE_MS) {
    return { ready: false, reason: "inventory-stale" };
  }

  if (!snapshot.software || typeof snapshot.software !== "object" || Array.isArray(snapshot.software)) {
    return { ready: false, reason: "inventory-invalid" };
  }
  const capture = (snapshot.software as { capture?: unknown }).capture;
  if (!capture || typeof capture !== "object" || Array.isArray(capture) || (capture as { gameModeReady?: unknown }).gameModeReady !== true) {
    return { ready: false, reason: "capture-not-ready" };
  }

  return { ready: true, audio: readGameAudio(snapshot) };
}
