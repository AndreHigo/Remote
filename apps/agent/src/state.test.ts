import test from "node:test";
import assert from "node:assert/strict";
import { isValidAgentState } from "./state.js";

test("rejeita estado vazio ou incompleto para forcar novo cadastro", () => {
  assert.equal(isValidAgentState({}), false);
  assert.equal(isValidAgentState({ deviceId: "device-1" }), false);
  assert.equal(isValidAgentState(null), false);
});

test("aceita estado persistido completo", () => {
  assert.equal(isValidAgentState({
    deviceId: "device-1",
    remoteId: "DESKTOP-01",
    displayName: "DESKTOP-01"
  }), true);
});
