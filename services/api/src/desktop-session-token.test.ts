import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopSessionToken, hashToken, verifyDesktopSessionToken } from "./desktop-session-token.js";

test("tokeno de desktop e assinado, curto e verificavel", () => {
  const created = createDesktopSessionToken({
    sessionId: "session-1",
    deviceId: "device-1",
    mode: "support",
    role: "client",
    remoteId: "123 456 789"
  });

  assert.equal(verifyDesktopSessionToken(created.token)?.sessionId, "session-1");
  assert.equal(hashToken(created.token), created.hash);
  assert.notEqual(created.token, created.hash);
});

test("tokeno adulterado ou truncado e rejeitado", () => {
  const created = createDesktopSessionToken({ sessionId: "session-1", deviceId: "device-1", mode: "game", role: "host" });
  assert.equal(verifyDesktopSessionToken(`${created.token}x`), null);
  assert.equal(verifyDesktopSessionToken(created.token.split(".")[0]), null);
});
