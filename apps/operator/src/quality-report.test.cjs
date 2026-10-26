const assert = require("node:assert/strict");
const test = require("node:test");
const { reportFileStem, sanitizeQualityReport, serializeQualityReport } = require("./quality-report.cjs");

test("relatorio nativo preserva metricas e remove credenciais", () => {
  const report = sanitizeQualityReport({
    generatedAt: "2026-10-26T01:00:00.000Z",
    sessionId: "session-1",
    deviceId: "DESKTOP/01",
    mode: "game",
    durationMs: 12_345.8,
    firstFrameMs: 420.4,
    latestRttMs: 31.7,
    latencyP95Ms: 48.2,
    currentFps: 59.9,
    framesReceived: 600,
    bytesReceived: 2_000_000,
    droppedLocalFrames: 2,
    relayDroppedFrames: 3,
    relayDroppedBytes: 1200,
    reconnects: 1,
    latencySamplesMs: [10, 20, 30],
    accessToken: "nao-deve-sair"
  });

  assert.deepEqual(report, {
    schemaVersion: 1,
    generatedAt: "2026-10-26T01:00:00.000Z",
    sessionId: "session-1",
    deviceId: "DESKTOP/01",
    mode: "game",
    durationMs: 12_345,
    firstFrameMs: 420.4,
    latestRttMs: 31.7,
    latencyP95Ms: 48.2,
    currentFps: 59.9,
    framesReceived: 600,
    bytesReceived: 2_000_000,
    droppedLocalFrames: 2,
    relayDroppedFrames: 3,
    relayDroppedBytes: 1200,
    reconnects: 1,
    latencySamplesMs: [10, 20, 30]
  });
  assert.equal(JSON.parse(serializeQualityReport({ ...report, accessToken: "nao-deve-sair" })).accessToken, undefined);
});

test("nome do relatorio nativo remove caracteres de caminho", () => {
  assert.equal(reportFileStem("DESKTOP/01:teste"), "DESKTOP-01-teste");
  assert.equal(reportFileStem(""), "sessao");
});
