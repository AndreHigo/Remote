const MAX_REPORT_BYTES = 256 * 1024;

function sanitizeQualityReport(input) {
  if (!input || typeof input !== "object") throw new Error("Relatorio de qualidade invalido.");
  const value = input;
  const generatedAt = typeof value.generatedAt === "string" && Number.isFinite(Date.parse(value.generatedAt))
    ? new Date(value.generatedAt).toISOString()
    : new Date().toISOString();

  return {
    schemaVersion: 1,
    generatedAt,
    sessionId: safeText(value.sessionId),
    deviceId: safeText(value.deviceId),
    mode: value.mode === "game" ? "game" : null,
    durationMs: nonNegativeInteger(value.durationMs),
    firstFrameMs: nullableNumber(value.firstFrameMs),
    latestRttMs: nullableNumber(value.latestRttMs),
    latencyP95Ms: nullableNumber(value.latencyP95Ms),
    currentFps: nonNegativeNumber(value.currentFps),
    framesReceived: nonNegativeInteger(value.framesReceived),
    bytesReceived: nonNegativeInteger(value.bytesReceived),
    droppedLocalFrames: nonNegativeInteger(value.droppedLocalFrames),
    relayDroppedFrames: nonNegativeInteger(value.relayDroppedFrames),
    relayDroppedBytes: nonNegativeInteger(value.relayDroppedBytes),
    reconnects: nonNegativeInteger(value.reconnects),
    latencySamplesMs: Array.isArray(value.latencySamplesMs)
      ? value.latencySamplesMs.filter((sample) => typeof sample === "number" && Number.isFinite(sample) && sample >= 0).slice(-120)
      : []
  };
}

function serializeQualityReport(input) {
  const json = `${JSON.stringify(sanitizeQualityReport(input), null, 2)}\n`;
  if (Buffer.byteLength(json, "utf8") > MAX_REPORT_BYTES) throw new Error("Relatorio de qualidade excede o limite permitido.");
  return json;
}

function reportFileStem(deviceId) {
  const normalized = String(deviceId || "sessao").trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 80) || "sessao";
}

function safeText(value) {
  return typeof value === "string" && value.length <= 160 ? value : null;
}

function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0;
}

function nullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

module.exports = { MAX_REPORT_BYTES, reportFileStem, sanitizeQualityReport, serializeQualityReport };
