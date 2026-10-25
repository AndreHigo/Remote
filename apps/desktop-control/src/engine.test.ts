import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopEngine } from "./engine.js";

test("modo jogo detecta o cliente operador nativo ou informa a plataforma ausente", async () => {
  const readiness = await createDesktopEngine("game").check();

  assert.equal(readiness.ready, readiness.code === "ready");
  assert.equal(/ainda esta[o ] em implementacao/i.test(readiness.message), false);
  assert.ok(["ready", "missing-engine", "unsupported-platform"].includes(readiness.code));
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
