import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopEngine } from "./engine.js";

test("modo jogo permanece bloqueado enquanto a janela nativa nao esta pronta", async () => {
  const readiness = await createDesktopEngine("game").check();

  assert.equal(readiness.ready, false);
  assert.equal(readiness.code, "not-implemented");
});

test("modo suporte exige um cliente local antes de iniciar", async () => {
  const result = await createDesktopEngine("support").start({
    sessionId: "session-test",
    deviceId: "device-test",
    mode: "support",
    role: "client",
    remoteId: "123 456 789"
  });

  assert.equal(result.started, false);
  assert.match(result.message, /RustDesk|cliente de suporte/i);
});
