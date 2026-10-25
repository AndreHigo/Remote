import assert from "node:assert/strict";
import test from "node:test";
import { validateInputEvent } from "./input.js";

test("entrada realtime continua tipada antes do envio", () => {
  assert.deepEqual(validateInputEvent({ type: "mouse.relative", dx: 18, dy: -9 }), {
    type: "mouse.relative",
    dx: 18,
    dy: -9
  });
});

test("entrada realtime nao aceita comandos ou scan codes fora do limite", () => {
  assert.throws(() => validateInputEvent({ type: "shell", command: "whoami" }), /nao permitido/);
  assert.throws(() => validateInputEvent({ type: "key", scanCode: 999, action: "down" }), /nao permitido/);
});
