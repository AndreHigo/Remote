import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import test from "node:test";
import WebSocket from "ws";

test("relay autentica os dois papeis e encaminha video e entrada", async (t) => {
  const secret = "integration-realtime-secret";
  process.env.DESKTOP_SESSION_SECRET = secret;
  process.env.REALTIME_INTERNAL_SECRET = "relay-internal-test-secret";

  const api = http.createServer(async (request, response) => {
    if (request.url !== "/desktop-sessions/authorize-channel" || request.headers["x-realtime-secret"] !== process.env.REALTIME_INTERNAL_SECRET) {
      response.writeHead(401).end();
      return;
    }

    let body = "";
    for await (const chunk of request) body += chunk;
    const accessToken = (JSON.parse(body) as { accessToken: string }).accessToken;
    const tokenBody = accessToken.split(".")[0];
    const payload = JSON.parse(Buffer.from(tokenBody, "base64url").toString("utf8")) as { role: "host" | "client"; mode: "game"; sessionId: string; deviceId: string };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ...payload, expiresAt: new Date(Date.now() + 60_000).toISOString() }));
  });
  await listen(api, 0);
  let relay: { server: http.Server; close(): Promise<void> } | undefined;
  let host: WebSocket | undefined;
  let client: WebSocket | undefined;
  let duplicate: WebSocket | undefined;
  let reconnectedClient: WebSocket | undefined;
  let expiringHost: WebSocket | undefined;
  let expiringClient: WebSocket | undefined;
  t.after(async () => {
    host?.terminate();
    client?.terminate();
    duplicate?.terminate();
    reconnectedClient?.terminate();
    expiringHost?.terminate();
    expiringClient?.terminate();
    if (relay) await relay.close();
    if (api.listening) await closeServer(api);
  });

  const apiAddress = api.address();
  assert.ok(apiAddress && typeof apiAddress !== "string");
  process.env.REALTIME_API_URL = `http://127.0.0.1:${apiAddress.port}`;
  const { createRealtimeServer } = await import("./server.js");
  relay = createRealtimeServer();
  await listen(relay.server, 0);
  const relayAddress = relay.server.address();
  assert.ok(relayAddress && typeof relayAddress !== "string");
  const url = `ws://127.0.0.1:${relayAddress.port}/sessions/session-1`;

  const hostSocket = await connect(url);
  const clientSocket = await connect(url);
  host = hostSocket;
  client = clientSocket;
  const hostMessages = createMessageQueue(hostSocket);
  const clientMessages = createMessageQueue(clientSocket);
  hostSocket.send(JSON.stringify({ type: "hello", accessToken: token("host") }));
  clientSocket.send(JSON.stringify({ type: "hello", accessToken: token("client") }));

  const hostReady = await nextJson(hostMessages);
  const clientReady = await nextJson(clientMessages);
  assert.equal(hostReady.type, "ready");
  assert.equal(clientReady.type, "ready");
  assert.equal([hostReady.peerConnected, clientReady.peerConnected].includes(true), true);
  if (!hostReady.peerConnected) {
    const hostPeerReady = await nextJson(hostMessages);
    assert.equal(hostPeerReady.peerConnected, true);
  }

  const frame = Buffer.from("fragmented-mp4-frame");
  hostSocket.send(frame);
  const clientFrame = await nextBinary(clientMessages);
  assert.deepEqual(clientFrame, frame);

  clientSocket.send(JSON.stringify({ type: "input", event: { type: "key", scanCode: 30, action: "down" } }));
  assert.deepEqual(await nextJson(hostMessages), { type: "input", event: { type: "key", scanCode: 30, action: "down" } });

  const duplicateSocket = await connect(url);
  duplicate = duplicateSocket;
  duplicateSocket.send(JSON.stringify({ type: "hello", accessToken: token("host") }));
  const duplicateClose = await onceClose(duplicateSocket);
  assert.equal(duplicateClose.code, 1008);
  assert.match(duplicateClose.reason, /role-already-connected/);

  clientSocket.close();
  const closed = await nextJson(hostMessages);
  assert.deepEqual(closed, { type: "closed", reason: "peer-disconnected" });

  reconnectedClient = await connect(url);
  const reconnectedMessages = createMessageQueue(reconnectedClient);
  reconnectedClient.send(JSON.stringify({ type: "hello", accessToken: token("client") }));
  assert.equal((await nextJson(reconnectedMessages)).type, "ready");
  assert.deepEqual(await nextBinary(reconnectedMessages), frame);
  reconnectedClient.close();
  assert.equal((await nextJson(hostMessages)).peerConnected, true);
  assert.deepEqual(await nextJson(hostMessages), { type: "closed", reason: "peer-disconnected" });

  expiringHost = await connect(url.replace("session-1", "session-expiring"));
  expiringClient = await connect(url.replace("session-1", "session-expiring"));
  const expiringHostMessages = createMessageQueue(expiringHost);
  const expiringClientMessages = createMessageQueue(expiringClient);
  expiringHost.send(JSON.stringify({ type: "hello", accessToken: token("host", "session-expiring", Date.now() + 750) }));
  expiringClient.send(JSON.stringify({ type: "hello", accessToken: token("client", "session-expiring", Date.now() + 750) }));
  const expiringHostReady = await nextJson(expiringHostMessages);
  assert.equal(expiringHostReady.type, "ready");
  if (!expiringHostReady.peerConnected) assert.equal((await nextJson(expiringHostMessages)).peerConnected, true);
  assert.equal((await nextJson(expiringClientMessages)).type, "ready");
  assert.equal((await nextJson(expiringHostMessages)).reason, "session-expired");
  assert.equal((await nextJson(expiringClientMessages)).reason, "session-expired");

  function token(role: "host" | "client", targetSessionId = "session-1", expiresAt = Date.now() + 60_000) {
    const body = Buffer.from(JSON.stringify({
      sessionId: targetSessionId,
      deviceId: "device-1",
      mode: "game",
      role,
      nonce: `${role}-nonce`,
      exp: expiresAt
    })).toString("base64url");
    return `${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`;
  }
});

async function connect(url: string) {
  const socket = new WebSocket(url, { origin: "http://localhost:5173" });
  await withTimeout(once(socket, "open"), "WebSocket open");
  return socket;
}

interface MessageQueue {
  next(): Promise<[WebSocket.RawData, boolean]>;
}

async function nextJson(queue: MessageQueue) {
  const [data, isBinary] = await withTimeout(queue.next(), "WebSocket message");
  assert.equal(isBinary, false);
  return JSON.parse(data.toString("utf8")) as Record<string, unknown>;
}

async function nextBinary(queue: MessageQueue) {
  const [data, isBinary] = await withTimeout(queue.next(), "WebSocket message");
  assert.equal(isBinary, true);
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(new Uint8Array(data));
}

function createMessageQueue(socket: WebSocket): MessageQueue {
  const messages: Array<[WebSocket.RawData, boolean]> = [];
  const waiters: Array<(message: [WebSocket.RawData, boolean]) => void> = [];
  socket.on("message", (data, isBinary) => {
    const message: [WebSocket.RawData, boolean] = [data, isBinary];
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else messages.push(message);
  });
  return {
    next() {
      const message = messages.shift();
      if (message) return Promise.resolve(message);
      return new Promise((resolve) => waiters.push(resolve));
    }
  };
}

function onceClose(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return withTimeout(new Promise((resolve) => socket.once("close", (code, reason) => resolve({ code, reason: reason.toString("utf8") }))), "WebSocket close");
}

function once(emitter: NodeJS.EventEmitter, event: string) {
  return new Promise<void>((resolve) => emitter.once(event, () => resolve()));
}

function withTimeout<T>(promise: Promise<T>, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), 3000);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function listen(server: http.Server, port: number) {
  return new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve()));
}

function closeServer(server: http.Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}
