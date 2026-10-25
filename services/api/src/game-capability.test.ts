import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGameCapability } from "./game-capability.js";

const now = Date.parse("2026-10-25T19:00:00.000Z");

test("aceita inventario recente com captura pronta", () => {
  assert.deepEqual(evaluateGameCapability({
    collectedAt: "2026-10-25T18:55:00.000Z",
    software: { capture: { gameModeReady: true } }
  }, now), { ready: true });
});

test("recusa aprovacao sem inventario", () => {
  assert.deepEqual(evaluateGameCapability(null, now), { ready: false, reason: "inventory-missing" });
});

test("recusa inventario desatualizado ou no futuro", () => {
  assert.equal(evaluateGameCapability({ collectedAt: "2026-10-25T18:30:00.000Z", software: { capture: { gameModeReady: true } } }, now).reason, "inventory-stale");
  assert.equal(evaluateGameCapability({ collectedAt: "2026-10-25T19:01:00.000Z", software: { capture: { gameModeReady: true } } }, now).reason, "inventory-stale");
});

test("recusa captura sem prontidao publicada", () => {
  assert.equal(evaluateGameCapability({ collectedAt: "2026-10-25T18:59:00.000Z", software: { capture: { gameModeReady: false } } }, now).reason, "capture-not-ready");
  assert.equal(evaluateGameCapability({ collectedAt: "2026-10-25T18:59:00.000Z", software: {} }, now).reason, "capture-not-ready");
});
