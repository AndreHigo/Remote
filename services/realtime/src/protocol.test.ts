import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { maxControlMessageBytes, parseControlMessage, verifyChannelToken } from "./protocol.js";

test("protocolo aceita hello, ping e entrada tipada", () => {
  assert.deepEqual(parseControlMessage(JSON.stringify({ type: "hello", accessToken: "abc" })), { type: "hello", accessToken: "abc" });
  assert.deepEqual(parseControlMessage(JSON.stringify({ type: "ping" })), { type: "ping" });
  assert.deepEqual(parseControlMessage(JSON.stringify({ type: "input", event: { type: "key", scanCode: 30 } })), {
    type: "input",
    event: { type: "key", scanCode: 30 }
  });
});

test("protocolo rejeita controle grande ou formato arbitrario", () => {
  assert.equal(parseControlMessage("x".repeat(maxControlMessageBytes() + 1)), null);
  assert.equal(parseControlMessage(JSON.stringify({ type: "shell", command: "whoami" })), null);
});

test("token do canal valida assinatura e expiracao", () => {
  const payload = Buffer.from(JSON.stringify({
    sessionId: "session-1",
    deviceId: "device-1",
    mode: "game",
    role: "host",
    nonce: "nonce-1",
    exp: Date.now() + 60_000
  })).toString("base64url");
  const secret = process.env.DESKTOP_SESSION_SECRET ?? process.env.JWT_SECRET ?? "remoto-local-desktop-secret-change-me";
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  assert.equal(verifyChannelToken(`${payload}.${signature}`)?.sessionId, "session-1");
  assert.equal(verifyChannelToken(`${payload}.bad`), null);
});
