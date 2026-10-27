import assert from "node:assert/strict";
import test from "node:test";
import { channelTokenSignatureForTest, maxControlMessageBytes, parseControlMessage, verifyChannelToken } from "./protocol.js";

test("protocolo aceita hello, ping e entrada tipada", () => {
  assert.deepEqual(parseControlMessage(JSON.stringify({ type: "hello", accessToken: "abc" })), { type: "hello", accessToken: "abc" });
  assert.deepEqual(parseControlMessage(JSON.stringify({ type: "ping" })), { type: "ping" });
  assert.deepEqual(parseControlMessage(JSON.stringify({ type: "input", event: { type: "key", scanCode: 30, action: "down" } })), {
    type: "input",
    event: { type: "key", scanCode: 30, action: "down" }
  });
});

test("protocolo aceita troca de monitor dentro do limite", () => {
  assert.deepEqual(parseControlMessage(JSON.stringify({ type: "monitor", index: 2 })), { type: "monitor", index: 2 });
  assert.equal(parseControlMessage(JSON.stringify({ type: "monitor", index: 17 })), null);
});

test("protocolo aceita o mapa de monitores publicado pelo host", () => {
  assert.deepEqual(parseControlMessage(JSON.stringify({
    type: "monitors",
    activeIndex: 1,
    monitors: [{ index: 0, name: "DISPLAY1", x: 0, y: 0, width: 1920, height: 1080, primary: true }]
  })), {
    type: "monitors",
    activeIndex: 1,
    monitors: [{ index: 0, name: "DISPLAY1", x: 0, y: 0, width: 1920, height: 1080, primary: true }]
  });
  assert.equal(parseControlMessage(JSON.stringify({ type: "monitors", monitors: [{ index: 0, name: "DISPLAY1", width: 0, height: 1080, x: 0, y: 0, primary: true }] })), null);
});

test("protocolo rejeita controle grande ou formato arbitrario", () => {
  assert.equal(parseControlMessage("x".repeat(maxControlMessageBytes() + 1)), null);
  assert.equal(parseControlMessage(JSON.stringify({ type: "shell", command: "whoami" })), null);
  assert.equal(parseControlMessage(JSON.stringify({ type: "input", event: { type: "key", scanCode: 999, action: "down" } })), null);
  assert.equal(parseControlMessage(JSON.stringify({ type: "input", event: { type: "mouse.button", button: "left" } })), null);
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
  const signature = channelTokenSignatureForTest(payload);
  assert.equal(verifyChannelToken(`${payload}.${signature}`)?.sessionId, "session-1");
  assert.equal(verifyChannelToken(`${payload}.bad`), null);
});
