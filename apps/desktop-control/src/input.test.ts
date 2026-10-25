import assert from "node:assert/strict";
import test from "node:test";
import { validateInputEvent } from "./input.js";

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
});

test("entrada rejeita comando arbitrario e scan code fora da faixa", () => {
  assert.throws(() => validateInputEvent({ type: "shell", command: "whoami" }), /nao permitido/);
  assert.throws(() => validateInputEvent({ type: "key", scanCode: 999, action: "down" }), /nao permitido/);
});
