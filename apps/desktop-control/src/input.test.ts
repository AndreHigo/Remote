import assert from "node:assert/strict";
import test from "node:test";
import { createInputReleaseTracker, validateInputEvent } from "./input.js";

test("entrada aceita somente eventos tipados e limita movimento", () => {
  assert.deepEqual(validateInputEvent({ type: "mouse.relative", dx: 99999, dy: -99999 }), {
    type: "mouse.relative",
    dx: 32767,
    dy: -32768
  });
  assert.deepEqual(validateInputEvent({ type: "key", scanCode: 30, action: "down" }), {
    type: "key",
    scanCode: 30,
    action: "down"
  });
  assert.deepEqual(validateInputEvent({ type: "key", scanCode: 72, action: "down", extended: true }), {
    type: "key",
    scanCode: 72,
    action: "down",
    extended: true
  });
});

test("entrada rejeita comando arbitrario e scan code fora da faixa", () => {
  assert.throws(() => validateInputEvent({ type: "shell", command: "whoami" }), /nao permitido/);
  assert.throws(() => validateInputEvent({ type: "key", scanCode: 999, action: "down" }), /nao permitido/);
  assert.throws(() => validateInputEvent({ type: "key", scanCode: 72, action: "down", extended: "yes" }), /nao permitido/);
});

test("entrada libera teclas e botoes mantidos quando a sessao encerra", () => {
  const tracker = createInputReleaseTracker();
  tracker.observe({ type: "key", scanCode: 30, action: "down" });
  tracker.observe({ type: "key", scanCode: 72, action: "down", extended: true });
  tracker.observe({ type: "mouse.button", button: "left", action: "down" });
  tracker.observe({ type: "key", scanCode: 30, action: "up" });

  assert.deepEqual(tracker.releaseEvents(), [
    { type: "mouse.button", button: "left", action: "up" },
    { type: "key", scanCode: 72, action: "up", extended: true }
  ]);
  assert.deepEqual(tracker.releaseEvents(), []);
});
