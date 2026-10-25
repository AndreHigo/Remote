import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough } from "node:stream";
import WebSocket from "ws";
import { validateInputEvent } from "./input.js";
import { forwardCaptureFrames } from "./realtime.js";

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
