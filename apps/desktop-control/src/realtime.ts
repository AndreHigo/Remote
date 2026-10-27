import WebSocket from "ws";
import type { Readable } from "node:stream";
import { startWindowsCapture, type CaptureProfile, type CaptureProcess } from "./capture.js";
import { WindowsInputBridge, validateInputEvent, type RemoteInputEvent } from "./input.js";
import type { DesktopSessionDescriptor } from "./engine.js";

export interface RealtimeClientOptions {
  url?: string;
  capture?: CaptureProfile;
  monitors?: RealtimeMonitor[];
  captureFactory?: (profile?: CaptureProfile) => CaptureProcess;
  onMonitorChange?: (monitorIndex: number) => Promise<CaptureProfile | undefined>;
  inputFactory?: () => RealtimeInputBridge;
  onFrame?: (frame: Buffer) => void;
  onReady?: (peerConnected: boolean) => void;
  onLatencyMs?: (latencyMs: number) => void;
  onMetrics?: (metrics: RealtimeMetrics) => void;
  onClosed?: (reason: string) => void;
}

export interface RealtimeMonitor {
  index: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

export interface RealtimeMetrics {
  framesReceived: number;
  videoFramesReceived: number;
  bytesReceived: number;
  firstFrameMs?: number;
  latencyMs?: number;
  latencyP95Ms?: number;
  relayDroppedFrames?: number;
  relayDroppedBytes?: number;
}

export interface RealtimeInputBridge {
  send(value: RemoteInputEvent): void;
  close(): void;
}

export interface RealtimeConnection {
  readonly socket: WebSocket;
  sendInput(event: RemoteInputEvent): void;
  sendMonitor(monitorIndex: number): void;
  close(): void;
}

export async function connectRemoteSession(
  session: DesktopSessionDescriptor,
  options: RealtimeClientOptions = {}
): Promise<RealtimeConnection> {
  if (!session.accessToken) throw new Error("Sessao realtime exige accessToken");
  const url = buildRealtimeSessionUrl(options.url ?? (process.env.REMOTO_REALTIME_URL ?? "ws://localhost:4200"), session.sessionId);
  const socket = new WebSocket(url);
  let capture: CaptureProcess | undefined;
  let input: RealtimeInputBridge | undefined;
  let detachCapture: (() => void) | undefined;
  let cleanedUp = false;
  let pingTimer: NodeJS.Timeout | undefined;
  let metricsTimer: NodeJS.Timeout | undefined;
  let closedNotified = false;
  const startedAt = Date.now();
  let framesReceived = 0;
  let videoFramesReceived = 0;
  let bytesReceived = 0;
  let videoTrackId: number | undefined;
  let firstFrameMs: number | undefined;
  let latencyMs: number | undefined;
  let relayDroppedFrames = 0;
  let relayDroppedBytes = 0;
  let captureGeneration = 0;
  const latencySamples: number[] = [];
  let lastMetricsAt = 0;

  function publishMetrics(force = false) {
    const now = Date.now();
    if (!force && now - lastMetricsAt < 1_000) return;
    lastMetricsAt = now;
    options.onMetrics?.({
      framesReceived,
      videoFramesReceived,
      bytesReceived,
      firstFrameMs,
      latencyMs,
      latencyP95Ms: percentile(latencySamples, 0.95),
      relayDroppedFrames,
      relayDroppedBytes
    });
  }

  function notifyClosed(reason: string) {
    if (closedNotified) return;
    closedNotified = true;
    options.onClosed?.(reason);
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1002, "handshake-failed");
      }
      reject(error);
    };

    const handleSocketError = (error: Error) => {
      if (!settled) fail(error);
      else notifyClosed(error.message || "erro-de-rede");
    };
    socket.on("error", handleSocketError);
    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "hello", accessToken: session.accessToken }));
    });
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        if (session.role === "client") {
          const frame = toBuffer(data);
          framesReceived += 1;
          bytesReceived += frame.byteLength;
          videoTrackId ??= findVideoTrackId(frame);
          videoFramesReceived += countVideoSamples(frame, videoTrackId);
          const isFirstFrame = firstFrameMs === undefined;
          if (isFirstFrame) firstFrameMs = Math.max(0, Date.now() - startedAt);
          options.onFrame?.(frame);
          publishMetrics(isFirstFrame);
        }
        return;
      }

      let message: { type?: string; peerConnected?: boolean; reason?: string; sentAt?: number; relayDroppedFrames?: number; relayDroppedBytes?: number; index?: number };
      try {
        message = JSON.parse(toBuffer(data).toString("utf8")) as typeof message;
      } catch {
        fail(new Error("Resposta realtime invalida"));
        return;
      }

      if (message.type === "ready") {
        if (settled) return;
        settled = true;
        options.onReady?.(message.peerConnected === true);
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping", sentAt: Date.now() }));
        }, 2000);
        if (session.role === "client" && options.onMetrics) {
          metricsTimer = setInterval(() => publishMetrics(true), 1000);
        }
        if (session.role === "host") {
          try {
            input = options.inputFactory?.() ?? new WindowsInputBridge();
            if (options.monitors?.length) {
              socket.send(JSON.stringify({
                type: "monitors",
                monitors: options.monitors,
                ...(Number.isInteger(options.capture?.monitorIndex) ? { activeIndex: options.capture?.monitorIndex } : {})
              }));
            }
            startCapture(options.capture);
          } catch (error) {
            closeWithReason(error instanceof Error ? error.message : String(error));
            fail(error instanceof Error ? error : new Error(String(error)));
            return;
          }
        }
        resolve();
        return;
      }

      if (message.type === "pong" && typeof message.sentAt === "number") {
        latencyMs = Math.max(0, Date.now() - message.sentAt);
        latencySamples.push(latencyMs);
        if (latencySamples.length > 60) latencySamples.shift();
        options.onLatencyMs?.(latencyMs);
        publishMetrics();
        return;
      }

      if (message.type === "quality") {
        if (typeof message.relayDroppedFrames === "number" && Number.isFinite(message.relayDroppedFrames)) {
          relayDroppedFrames = Math.max(0, Math.floor(message.relayDroppedFrames));
        }
        if (typeof message.relayDroppedBytes === "number" && Number.isFinite(message.relayDroppedBytes)) {
          relayDroppedBytes = Math.max(0, Math.floor(message.relayDroppedBytes));
        }
        publishMetrics(true);
        return;
      }

      const requestedMonitorIndex = message.type === "monitor" ? message.index : undefined;
      if (message.type === "monitor" && session.role === "host" && typeof requestedMonitorIndex === "number" && Number.isInteger(requestedMonitorIndex) && requestedMonitorIndex >= 0 && requestedMonitorIndex <= 16) {
        void switchCaptureToMonitor(requestedMonitorIndex);
        return;
      }

      if (message.type === "input" && session.role === "host" && input) {
        try {
          input.send(validateInputEvent((message as { event: unknown }).event));
        } catch {
          closeWithReason("entrada-remota-invalida");
        }
        return;
      }

      if (message.type === "closed") {
        notifyClosed(message.reason ?? "sessao-encerrada");
        cleanup();
        socket.close(1000, "peer-closed");
      }
    });

    function closeWithReason(reason: string) {
      notifyClosed(reason);
      socket.close(1011, reason.slice(0, 120));
    }

    function startCapture(profile?: CaptureProfile) {
      const nextCapture = options.captureFactory?.(profile) ?? startWindowsCapture(profile);
      const previousCapture = capture;
      const previousDetach = detachCapture;
      const generation = ++captureGeneration;
      let captureError = "";
      nextCapture.process.stderr.setEncoding("utf8");
      nextCapture.process.stderr.on("data", (chunk: string) => {
        captureError = `${captureError}${chunk}`.slice(-2000);
      });
      const nextDetach = forwardCaptureFrames(nextCapture.process.stdout, socket);
      nextCapture.process.once("error", (error) => {
        if (captureGeneration === generation) closeWithReason(`captura: ${error.message}`);
      });
      nextCapture.process.once("close", (code) => {
        if (captureGeneration === generation && code !== null && code !== 0) {
          closeWithReason(`captura encerrou (${code}): ${captureError.trim() || "erro do FFmpeg"}`);
        }
      });
      capture = nextCapture;
      detachCapture = nextDetach;
      previousDetach?.();
      previousCapture?.stop();
    }

    async function switchCaptureToMonitor(monitorIndex: number) {
      if (!options.onMonitorChange) return;
      try {
        const nextProfile = await options.onMonitorChange(monitorIndex);
        if (nextProfile) startCapture(nextProfile);
      } catch (error) {
        closeWithReason(error instanceof Error ? error.message : String(error));
      }
    }

    function cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = undefined;
      if (metricsTimer) clearInterval(metricsTimer);
      metricsTimer = undefined;
      detachCapture?.();
      detachCapture = undefined;
      capture?.stop();
      input?.close();
    }

  socket.once("close", (_code, reason) => {
    cleanup();
    notifyClosed(reason.toString("utf8") || "sessao-realtime-encerrada");
  });
  });

  return {
    socket,
    sendInput(event) {
      if (session.role !== "client") throw new Error("Somente o cliente envia entrada");
      const safeEvent = validateInputEvent(event);
      if (socket.readyState !== WebSocket.OPEN) throw new Error("Sessao realtime encerrada");
      socket.send(JSON.stringify({ type: "input", event: safeEvent }));
    },
    sendMonitor(monitorIndex) {
      if (session.role !== "client") throw new Error("Somente o cliente troca o monitor");
      if (!Number.isInteger(monitorIndex) || monitorIndex < 0 || monitorIndex > 16) throw new Error("Monitor invalido");
      if (socket.readyState !== WebSocket.OPEN) throw new Error("Sessao realtime encerrada");
      socket.send(JSON.stringify({ type: "monitor", index: monitorIndex }));
    },
    close() {
      socket.close(1000, "client-closed");
    }
  };
}

export function forwardCaptureFrames(stdout: Readable, socket: WebSocket) {
  let pending = Buffer.alloc(0);
  let initializationBoxes: Buffer[] = [];
  let mediaBoxes: Buffer[] = [];
  let initialized = false;

  const sendSegment = (segment: Buffer, force = false) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    // Drop a complete fMP4 segment instead of cutting a box and corrupting MSE.
    if ((!force && socket.bufferedAmount > 4 * 1024 * 1024) || segment.byteLength > 8 * 1024 * 1024) return;
    socket.send(segment);
  };

  const onData = (chunk: Buffer) => {
    if (!chunk.byteLength) return;
    pending = Buffer.concat([pending, chunk]);
    if (pending.byteLength > 32 * 1024 * 1024) {
      pending = Buffer.alloc(0);
      initializationBoxes = [];
      mediaBoxes = [];
      initialized = false;
      return;
    }

    while (true) {
      const box = readMp4Box(pending);
      if (box === "incomplete") return;
      if (box === "invalid") {
        pending = Buffer.alloc(0);
        initializationBoxes = [];
        mediaBoxes = [];
        initialized = false;
        return;
      }
      pending = pending.subarray(box.byteLength);

      if (!initialized) {
        initializationBoxes.push(box.data);
        if (box.type === "moov") {
          sendSegment(Buffer.concat(initializationBoxes), true);
          initializationBoxes = [];
          initialized = true;
        }
        continue;
      }

      if (box.type === "styp" && mediaBoxes.length === 0) {
        mediaBoxes.push(box.data);
        continue;
      }
      if (box.type === "moof") {
        mediaBoxes.push(box.data);
        continue;
      }
      if (box.type === "mdat" && mediaBoxes.length > 0) {
        mediaBoxes.push(box.data);
        sendSegment(Buffer.concat(mediaBoxes));
        mediaBoxes = [];
      }
    }
  };

  stdout.on("data", onData);
  return () => stdout.off("data", onData);
}

function readMp4Box(buffer: Buffer) {
  if (buffer.byteLength < 8) return "incomplete" as const;
  const declaredSize = buffer.readUInt32BE(0);
  const type = buffer.toString("ascii", 4, 8);
  const headerSize = declaredSize === 1 ? 16 : 8;
  if (buffer.byteLength < headerSize) return "incomplete" as const;
  const byteLength = declaredSize === 1 ? Number(buffer.readBigUInt64BE(8)) : declaredSize;
  if (!Number.isSafeInteger(byteLength) || byteLength < headerSize || byteLength > 32 * 1024 * 1024) return "invalid" as const;
  if (buffer.byteLength < byteLength) return "incomplete" as const;
  return { type, byteLength, data: buffer.subarray(0, byteLength) };
}

export function buildRealtimeSessionUrl(configured: string, sessionId: string) {
  const base = configured.replace(/\/+$/, "");
  const sessionPath = `/sessions/${encodeURIComponent(sessionId)}`;
  return base.endsWith(sessionPath) ? base : `${base}${sessionPath}`;
}

export function findVideoTrackId(segment: Buffer) {
  for (const moov of findBoxes(segment, "moov")) {
    for (const trak of findBoxes(segment, "trak", moov.payloadStart, moov.end)) {
      const handler = findBoxDeep(segment, "hdlr", trak.payloadStart, trak.end);
      if (!handler || segment.toString("ascii", handler.payloadStart + 8, handler.payloadStart + 12) !== "vide") continue;
      const tkhd = findBoxes(segment, "tkhd", trak.payloadStart, trak.end)[0];
      if (!tkhd || tkhd.payloadStart + 16 > tkhd.end) continue;
      const version = segment[tkhd.payloadStart];
      const trackIdOffset = version === 1 ? tkhd.payloadStart + 20 : tkhd.payloadStart + 12;
      if (trackIdOffset + 4 <= tkhd.end) return segment.readUInt32BE(trackIdOffset);
    }
  }
  return undefined;
}

export function countVideoSamples(segment: Buffer, videoTrackId?: number) {
  const counts: number[] = [];
  for (const moof of findBoxes(segment, "moof")) {
    for (const traf of findBoxes(segment, "traf", moof.payloadStart, moof.end)) {
      const tfhd = findBoxes(segment, "tfhd", traf.payloadStart, traf.end)[0];
      const trackId = tfhd && tfhd.payloadStart + 8 <= tfhd.end ? segment.readUInt32BE(tfhd.payloadStart + 4) : undefined;
      if (videoTrackId !== undefined && trackId !== videoTrackId) continue;
      for (const trun of findBoxes(segment, "trun", traf.payloadStart, traf.end)) {
        if (trun.payloadStart + 8 <= trun.end) counts.push(segment.readUInt32BE(trun.payloadStart + 4));
      }
    }
  }
  return counts.length ? Math.max(...counts) : 0;
}

interface Mp4BoxRange {
  payloadStart: number;
  end: number;
}

function findBoxes(buffer: Buffer, type: string | undefined, start = 0, end = buffer.byteLength): Mp4BoxRange[] {
  const boxes: Mp4BoxRange[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const declaredSize = buffer.readUInt32BE(offset);
    const headerSize = declaredSize === 1 ? 16 : 8;
    if (offset + headerSize > end) break;
    const byteLength = declaredSize === 1 ? Number(buffer.readBigUInt64BE(offset + 8)) : declaredSize;
    if (!Number.isSafeInteger(byteLength) || byteLength < headerSize || offset + byteLength > end) break;
    if (type === undefined || buffer.toString("ascii", offset + 4, offset + 8) === type) boxes.push({ payloadStart: offset + headerSize, end: offset + byteLength });
    offset += byteLength;
  }
  return boxes;
}

function findBoxDeep(buffer: Buffer, type: string, start: number, end: number): Mp4BoxRange | undefined {
  for (const box of findBoxes(buffer, type, start, end)) return box;
  for (const box of findBoxes(buffer, undefined, start, end)) {
    const nested = findBoxDeep(buffer, type, box.payloadStart, box.end);
    if (nested) return nested;
  }
  return undefined;
}

function toBuffer(data: WebSocket.RawData) {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return undefined;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil((ordered.length - 1) * ratio))];
}
