import assert from "node:assert/strict";
import test from "node:test";
import { openNativeOperatorSession } from "./operator.js";

test("cliente operador exige role client", async () => {
  await assert.rejects(
    openNativeOperatorSession({
      sessionId: "session-test",
      deviceId: "device-test",
      mode: "game",
      role: "host",
      accessToken: "token"
    }),
    /role client/
  );
});

test("cliente operador deixa suporte RustDesk fora da fronteira nativa", async () => {
  await assert.rejects(
    openNativeOperatorSession({
      sessionId: "session-test",
      deviceId: "device-test",
      mode: "support",
      role: "client",
      accessToken: "token"
    }),
    /modo jogo/
  );
});
