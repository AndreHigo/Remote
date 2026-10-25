import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { PassThrough } from "node:stream";
import WebSocket, { WebSocketServer } from "ws";
import { validateInputEvent } from "./input.js";
import { buildRealtimeSessionUrl, connectRemoteSession, forwardCaptureFrames } from "./realtime.js";

test("monta o caminho da sessao quando o agente recebe apenas a base do relay", () => {
  assert.equal(buildRealtimeSessionUrl("wss://remoto.example/realtime", "session-1"), "wss://remoto.example/realtime/sessions/session-1");
  assert.equal(buildRealtimeSessionUrl("ws://127.0.0.1:4200/sessions/session-1", "session-1"), "ws://127.0.0.1:4200/sessions/session-1");
});

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

test("captura realtime encaminha bytes que chegam no stdout do FFmpeg", () => {
  const stdout = new PassThrough();
  const frames: Buffer[] = [];
  const socket = {
    readyState: WebSocket.OPEN,
    bufferedAmount: 0,
    send(chunk: Buffer) {
      frames.push(chunk);
    }
  } as unknown as WebSocket;

  const detach = forwardCaptureFrames(stdout, socket);
  stdout.write(Buffer.from("fragment-1"));
  detach();
  stdout.write(Buffer.from("fragment-2"));

  assert.deepEqual(frames, [Buffer.from("fragment-1")]);
});

test("cliente realtime notifica uma desconexao de socket e libera o agente para reconectar", async (t) => {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  t.after(async () => {
    wss.close();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "ready", sessionId: "session-test", mode: "game", peerConnected: true }));
    setTimeout(() => socket.close(1011, "network-down"), 20);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const reasons: string[] = [];
  await connectRemoteSession(
    { sessionId: "session-test", deviceId: "device-test", mode: "game", role: "client", accessToken: "session-token" },
    { url: `ws://127.0.0.1:${address.port}/sessions/session-test`, onClosed: (reason) => reasons.push(reason) }
  );
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.deepEqual(reasons, ["network-down"]);
});
