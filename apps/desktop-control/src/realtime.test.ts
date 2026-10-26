import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { PassThrough } from "node:stream";
import WebSocket, { WebSocketServer } from "ws";
import type { CaptureProcess } from "./capture.js";
import { validateInputEvent } from "./input.js";
import { summarizeRealtimeMeasurement } from "./measurement.js";
import { buildRealtimeSessionUrl, connectRemoteSession, forwardCaptureFrames, type RealtimeInputBridge } from "./realtime.js";

test("medicao realtime resume primeiro frame, FPS, bitrate e p95", () => {
  assert.deepEqual(
    summarizeRealtimeMeasurement({
      durationMs: 10_000,
      firstFrameMs: 420,
      framesReceived: 600,
      bytesReceived: 2_000_000,
      latencySamplesMs: [10, 20, 30, 40],
      firstFrameValid: true
    }),
    {
      schemaVersion: 1,
      durationMs: 10_000,
      firstFrameMs: 420,
      framesReceived: 600,
      fpsReceived: 60,
      bytesReceived: 2_000_000,
      bitrateKbps: 1600,
      latencySamples: 4,
      latencyAvgMs: 25,
      latencyP95Ms: 40,
      firstFrameValid: true,
      closedReason: null,
      result: "pass"
    }
  );
});

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
  const initialization = Buffer.concat([mp4Box("ftyp", Buffer.from("init")), mp4Box("moov", Buffer.from("meta"))]);
  const media = Buffer.concat([mp4Box("moof", Buffer.from("header")), mp4Box("mdat", Buffer.from("payload"))]);
  stdout.write(initialization.subarray(0, 9));
  stdout.write(Buffer.concat([initialization.subarray(9), media.subarray(0, 7)]));
  stdout.write(media.subarray(7));
  detach();

  assert.deepEqual(frames, [initialization, media]);
});

test("captura realtime reseta uma caixa malformada sem bloquear o proximo segmento", () => {
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
  stdout.write(Buffer.from([0, 0, 0, 4, 0, 0, 0, 0]));
  const initialization = Buffer.concat([mp4Box("ftyp", Buffer.from("init")), mp4Box("moov", Buffer.from("meta"))]);
  stdout.write(initialization);
  detach();

  assert.deepEqual(frames, [initialization]);
});

test("captura realtime preserva a inicializacao e descarta media sob congestionamento", () => {
  const stdout = new PassThrough();
  const frames: Buffer[] = [];
  const socket = {
    readyState: WebSocket.OPEN,
    bufferedAmount: 5 * 1024 * 1024,
    send(chunk: Buffer) {
      frames.push(chunk);
    }
  } as unknown as WebSocket;

  const initialization = Buffer.concat([mp4Box("ftyp", Buffer.from("init")), mp4Box("moov", Buffer.from("meta"))]);
  const media = Buffer.concat([mp4Box("moof", Buffer.from("header")), mp4Box("mdat", Buffer.from("payload"))]);
  const detach = forwardCaptureFrames(stdout, socket);
  stdout.write(Buffer.concat([initialization, media]));
  detach();

  assert.deepEqual(frames, [initialization]);
});

test("transporte realtime integra host e cliente com captura e entrada tipadas", async (t) => {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const sockets = new Map<string, WebSocket>();
  const receivedInputs: unknown[] = [];
  const frames: Buffer[] = [];
  const latencies: number[] = [];
  const metrics: Array<{ framesReceived: number; bytesReceived: number; firstFrameMs?: number; latencyP95Ms?: number }> = [];
  const inputBridge: RealtimeInputBridge = {
    send(value) {
      receivedInputs.push(value);
    },
    close() {}
  };

  wss.on("connection", (socket) => {
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        sockets.get("client")?.send(data, { binary: true });
        return;
      }

      const message = JSON.parse(data.toString("utf8")) as { type?: string; accessToken?: string; event?: unknown };
      if (message.type === "hello" && message.accessToken) {
        const role = message.accessToken === "host-token" ? "host" : "client";
        sockets.set(role, socket);
        socket.send(JSON.stringify({ type: "ready", peerConnected: sockets.has(role === "host" ? "client" : "host") }));
        socket.send(JSON.stringify({ type: "pong", sentAt: Date.now() - 5 }));
        return;
      }
      if (message.type === "input") sockets.get("host")?.send(JSON.stringify({ type: "input", event: message.event }));
    });
  });

  t.after(async () => {
    for (const socket of sockets.values()) socket.terminate();
    wss.close();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const fakeCapture = {
    process: {
      stdout,
      stderr,
      once() { return this; },
      on() { return this; },
      killed: false,
      kill() { this.killed = true; }
    },
    stop() { stdout.end(); }
  } as unknown as CaptureProcess;

  const host = await connectRemoteSession(
    { sessionId: "session-test", deviceId: "device-test", mode: "game", role: "host", accessToken: "host-token" },
    {
      url: `ws://127.0.0.1:${address.port}/sessions/session-test`,
      captureFactory: () => fakeCapture,
      inputFactory: () => inputBridge
    }
  );
  const client = await connectRemoteSession(
    { sessionId: "session-test", deviceId: "device-test", mode: "game", role: "client", accessToken: "client-token" },
    {
      url: `ws://127.0.0.1:${address.port}/sessions/session-test`,
      onFrame: (frame) => frames.push(frame),
      onLatencyMs: (latencyMs) => latencies.push(latencyMs),
      onMetrics: (value) => metrics.push(value)
    }
  );

  await waitFor(() => latencies.length === 1);
  assert.ok(latencies[0] >= 0 && latencies[0] < 1000);

  const initialization = Buffer.concat([mp4Box("ftyp", Buffer.from("init")), mp4Box("moov", Buffer.from("meta"))]);
  const media = Buffer.concat([mp4Box("moof", Buffer.from("header")), mp4Box("mdat", Buffer.from("payload"))]);
  stdout.write(Buffer.concat([initialization, media]));
  await waitFor(() => frames.length === 2);
  assert.deepEqual(frames, [initialization, media]);
  await waitFor(() => metrics.some((value) => value.framesReceived === 2));
  const latestMetrics = metrics.at(-1);
  assert.ok(latestMetrics);
  assert.equal(latestMetrics.framesReceived, 2);
  assert.equal(latestMetrics.bytesReceived, initialization.byteLength + media.byteLength);
  assert.ok((latestMetrics.firstFrameMs ?? -1) >= 0);
  assert.ok((latestMetrics.latencyP95Ms ?? -1) >= 0);

  client.sendInput({ type: "key", scanCode: 30, action: "down" });
  await waitFor(() => receivedInputs.length === 1);
  assert.deepEqual(receivedInputs, [{ type: "key", scanCode: 30, action: "down" }]);

  client.close();
  host.close();
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

test("cliente realtime fecha o socket quando o handshake recebe mensagem invalida", async (t) => {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  let serverSocketClosed = false;
  t.after(async () => {
    wss.close();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  wss.on("connection", (socket) => {
    socket.once("close", () => { serverSocketClosed = true; });
    socket.send("nao-e-json");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  await assert.rejects(
    connectRemoteSession(
      { sessionId: "session-test", deviceId: "device-test", mode: "game", role: "client", accessToken: "session-token" },
      { url: `ws://127.0.0.1:${address.port}/sessions/session-test` }
    ),
    /Resposta realtime invalida/
  );
  await waitFor(() => serverSocketClosed);
});

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(predicate(), true);
}

function mp4Box(type: string, payload: Buffer) {
  const box = Buffer.alloc(8 + payload.byteLength);
  box.writeUInt32BE(box.byteLength, 0);
  box.write(type, 4, 4, "ascii");
  payload.copy(box, 8);
  return box;
}
