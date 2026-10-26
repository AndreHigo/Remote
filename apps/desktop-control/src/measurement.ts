export interface RealtimeMeasurementInput {
  durationMs: number;
  firstFrameMs?: number;
  framesReceived: number;
  videoFramesReceived?: number;
  bytesReceived: number;
  relayDroppedFrames?: number;
  relayDroppedBytes?: number;
  latencySamplesMs: number[];
  firstFrameValid: boolean;
  closedReason?: string;
}

export interface RealtimeMeasurementReport {
  schemaVersion: 1;
  durationMs: number;
  firstFrameMs: number | null;
  framesReceived: number;
  videoFramesReceived: number;
  fpsReceived: number;
  bytesReceived: number;
  bitrateKbps: number;
  relayDroppedFrames: number;
  relayDroppedBytes: number;
  latencySamples: number;
  latencyAvgMs: number | null;
  latencyP95Ms: number | null;
  firstFrameValid: boolean;
  closedReason: string | null;
  result: "pass" | "fail";
}

export function summarizeRealtimeMeasurement(input: RealtimeMeasurementInput): RealtimeMeasurementReport {
  const durationMs = Math.max(1, input.durationMs);
  const durationSeconds = durationMs / 1_000;
  const latencySamples = input.latencySamplesMs.filter((value) => Number.isFinite(value) && value >= 0);
  const latencyAvgMs = latencySamples.length
    ? round(latencySamples.reduce((total, value) => total + value, 0) / latencySamples.length)
    : null;
  const latencyP95Ms = latencySamples.length ? round(percentile(latencySamples, 0.95)) : null;
  const videoFramesReceived = nonNegativeInteger(input.videoFramesReceived ?? input.framesReceived);

  return {
    schemaVersion: 1,
    durationMs,
    firstFrameMs: input.firstFrameMs ?? null,
    framesReceived: input.framesReceived,
    videoFramesReceived,
    fpsReceived: round(videoFramesReceived / durationSeconds),
    bytesReceived: input.bytesReceived,
    bitrateKbps: round((input.bytesReceived * 8) / durationSeconds / 1_000),
    relayDroppedFrames: nonNegativeInteger(input.relayDroppedFrames),
    relayDroppedBytes: nonNegativeInteger(input.relayDroppedBytes),
    latencySamples: latencySamples.length,
    latencyAvgMs,
    latencyP95Ms,
    firstFrameValid: input.firstFrameValid,
    closedReason: input.closedReason ?? null,
    result: input.firstFrameValid && videoFramesReceived > 0 ? "pass" : "fail"
  };
}

function percentile(values: number[], ratio: number) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil((ordered.length - 1) * ratio))];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function nonNegativeInteger(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
