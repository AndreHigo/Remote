import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { maxControlMessageBytes, parseControlMessage, verifyChannelToken, type ChannelTokenPayload, type ServerMessage, type SessionRole } from "./protocol.js";

const port = Number(process.env.REALTIME_PORT ?? 4200);
const maxFrameBytes = Number(process.env.REALTIME_MAX_FRAME_BYTES ?? 8 * 1024 * 1024);
const maxBufferedBytes = Number(process.env.REALTIME_MAX_BUFFERED_BYTES ?? 16 * 1024 * 1024);
const maxFrameRate = positiveLimit(process.env.REALTIME_MAX_FRAME_RATE, 120);
const maxFrameBytesPerSecond = positiveLimit(process.env.REALTIME_MAX_FRAME_BYTES_PER_SECOND, 64 * 1024 * 1024);
const maxInputEventsPerSecond = positiveLimit(process.env.REALTIME_MAX_INPUT_EVENTS_PER_SECOND, 1_000);
const maxPendingHandshakesPerAddress = positiveLimit(process.env.REALTIME_MAX_PENDING_HANDSHAKES, 8);
const maxPendingHandshakesTotal = positiveLimit(process.env.REALTIME_MAX_PENDING_HANDSHAKES_TOTAL, 256);
const trustProxyClientIp = process.env.REALTIME_TRUST_PROXY_CLIENT_IP === "true";
const maxConnections = Number(process.env.REALTIME_MAX_CONNECTIONS ?? 256);
const maxRooms = Number(process.env.REALTIME_MAX_ROOMS ?? 128);
const apiUrl = process.env.REALTIME_API_URL ?? "http://localhost:4100";
const internalSecret = process.env.REALTIME_INTERNAL_SECRET;
const allowedOrigins = new Set((process.env.REALTIME_ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean));

interface Peer {
  socket: WebSocket;
  payload: ChannelTokenPayload;
  role: SessionRole;
  accessToken: string;
  frameRateLimiter: FrameRateLimiter;
  inputRateLimiter: EventRateLimiter;
}

export interface FrameRateLimiter {
  allow(byteLength: number): boolean;
}

export interface EventRateLimiter {
  allow(): boolean;
}

interface Room {
  host?: Peer;
  client?: Peer;
  initialFrame?: Buffer;
  qualityTracker?: RelayQualityTracker;
  expiryTimer?: NodeJS.Timeout;
  revalidationTimer?: NodeJS.Timeout;
  expiresAt?: number;
}

export function createRealtimeServer() {
  const rooms = new Map<string, Room>();
  const pendingHandshakes = new Map<string, number>();
  let pendingHandshakesTotal = 0;
  let activeConnections = 0;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (request.method === "POST" && pathname.startsWith("/internal/sessions/") && pathname.endsWith("/close")) {
      const receivedSecret = request.headers["x-realtime-secret"];
      if (!internalSecret || typeof receivedSecret !== "string" || !secretsMatch(receivedSecret, internalSecret)) {
        response.writeHead(401).end();
        return;
      }
      const sessionId = pathname.slice("/internal/sessions/".length, -"/close".length).replace(/\/$/, "");
      const closed = closeRoom(sessionId, "session-ended", 1000);
      response.writeHead(closed ? 204 : 404).end();
      return;
    }
    if (request.method !== "GET" || pathname !== "/health") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ ok: true, service: "remoto-realtime" }));
  });
  const wss = new WebSocketServer({ server, maxPayload: Math.max(maxFrameBytes, maxControlMessageBytes()) });

  wss.on("connection", (socket, request) => {
    activeConnections += 1;
    if (activeConnections > maxConnections) {
      activeConnections -= 1;
      close(socket, "too-many-connections");
      return;
    }
    if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) {
      activeConnections -= 1;
      close(socket, "origin-not-allowed");
      return;
    }

    if (pendingHandshakesTotal >= maxPendingHandshakesTotal) {
      activeConnections -= 1;
      close(socket, "too-many-pending-handshakes");
      return;
    }
    const address = clientAddress(request);
    const pendingForAddress = pendingHandshakes.get(address) ?? 0;
    if (pendingForAddress >= maxPendingHandshakesPerAddress) {
      activeConnections -= 1;
      close(socket, "too-many-pending-handshakes");
      return;
    }
    pendingHandshakes.set(address, pendingForAddress + 1);
    pendingHandshakesTotal += 1;
    let pendingReleased = false;
    const releasePendingHandshake = () => {
      if (pendingReleased) return;
      pendingReleased = true;
      pendingHandshakesTotal = Math.max(0, pendingHandshakesTotal - 1);
      const next = (pendingHandshakes.get(address) ?? 1) - 1;
      if (next > 0) pendingHandshakes.set(address, next);
      else pendingHandshakes.delete(address);
    };

    let peer: Peer | null = null;
    let authenticating = false;
    const sessionId = new URL(request.url ?? "/", "http://localhost").pathname.split("/").filter(Boolean)[1];
    const helloTimeout = setTimeout(() => close(socket, "hello-timeout"), 5000);

    socket.on("message", async (data, isBinary) => {
      if (!peer) {
        if (authenticating) return;
        if (isBinary) return close(socket, "hello-required");
        const hello = parseControlMessage(toBuffer(data));
        if (!hello || hello.type !== "hello") return close(socket, "hello-required");
        authenticating = true;
        const payload = verifyChannelToken(hello.accessToken);
        if (!payload || payload.sessionId !== sessionId) return close(socket, "invalid-session-token");

        const authorized = await authorizeChannel(hello.accessToken);
        if (!authorized || authorized.sessionId !== payload.sessionId || authorized.deviceId !== payload.deviceId || authorized.mode !== payload.mode || authorized.role !== payload.role || (authorized.audio ?? "off") !== (payload.audio ?? "off")) {
          return close(socket, "channel-not-authorized");
        }

        const room = rooms.get(payload.sessionId) ?? { qualityTracker: createRelayQualityTracker() };
        room.qualityTracker ??= createRelayQualityTracker();
        if (!rooms.has(payload.sessionId) && rooms.size >= maxRooms) return close(socket, "too-many-rooms");
        if (room[payload.role]) return close(socket, "role-already-connected");
        const other = payload.role === "host" ? room.client : room.host;
        if (other && payload.mode === "game" && (other.payload.audio ?? "off") !== (payload.audio ?? "off")) {
          return close(socket, "media-capability-mismatch");
        }
        if (payload.role === "host") room.initialFrame = undefined;
        peer = {
          socket,
          payload,
          role: payload.role,
          accessToken: hello.accessToken,
          frameRateLimiter: createFrameRateLimiter(maxFrameRate, maxFrameBytesPerSecond),
          inputRateLimiter: createEventRateLimiter(maxInputEventsPerSecond)
        };
        room[payload.role] = peer;
        const nextExpiry = Math.min(room.expiresAt ?? payload.exp, payload.exp);
        if (room.expiryTimer) clearTimeout(room.expiryTimer);
        room.expiresAt = nextExpiry;
        room.expiryTimer = setTimeout(() => closeRoom(payload.sessionId, "session-expired", 1008), Math.max(1, nextExpiry - Date.now()));
        rooms.set(payload.sessionId, room);
        if (!room.revalidationTimer) {
          room.revalidationTimer = setInterval(() => {
            void revalidateRoom(payload.sessionId);
          }, 10_000);
        }
        clearTimeout(helloTimeout);
        releasePendingHandshake();
        send(socket, { type: "ready", sessionId: payload.sessionId, mode: payload.mode, peerConnected: Boolean(room.host && room.client) });
        if (other) send(other.socket, { type: "ready", sessionId: payload.sessionId, mode: payload.mode, peerConnected: true });
        if (payload.role === "client" && room.initialFrame && socket.readyState === WebSocket.OPEN) {
          socket.send(room.initialFrame, { binary: true });
        }
        return;
      }

    if (isBinary) {
      const frame = toBuffer(data);
      if (peer.role !== "host" || frame.byteLength > maxFrameBytes) return close(socket, "frame-too-large-or-role-not-allowed");
      if (!peer.frameRateLimiter.allow(frame.byteLength)) return close(socket, "frame-rate-limit");
      const room = rooms.get(peer.payload.sessionId);
      if (room && !room.initialFrame) room.initialFrame = frame;
      const client = room?.client;
      if (client?.socket.readyState === WebSocket.OPEN && client.socket.bufferedAmount <= maxBufferedBytes) {
        client.socket.send(frame, { binary: true });
      } else if (room && client?.socket.readyState === WebSocket.OPEN) {
        const quality = room.qualityTracker?.recordDrop(frame.byteLength);
        if (quality) send(client.socket, { type: "quality", ...quality });
      }
      return;
    }

    const message = parseControlMessage(toBuffer(data));
    if (!message) return close(socket, "invalid-control-message");
    if (message.type === "ping") {
      send(socket, { type: "pong", ...(message.sentAt === undefined ? {} : { sentAt: message.sentAt }) });
      return;
    }
    if (message.type === "input") {
      if (peer.role !== "client") return close(socket, "input-role-not-allowed");
      if (!peer.inputRateLimiter.allow()) return close(socket, "input-rate-limit");
      const host = rooms.get(peer.payload.sessionId)?.host;
      if (host?.socket.readyState === WebSocket.OPEN) host.socket.send(JSON.stringify(message));
      return;
    }
    if (message.type === "monitor") {
      if (peer.role !== "client") return close(socket, "monitor-role-not-allowed");
      if (!peer.inputRateLimiter.allow()) return close(socket, "monitor-rate-limit");
      const host = rooms.get(peer.payload.sessionId)?.host;
      if (host?.socket.readyState === WebSocket.OPEN) host.socket.send(JSON.stringify(message));
    }
    });

    socket.on("close", () => {
      activeConnections = Math.max(0, activeConnections - 1);
      releasePendingHandshake();
      clearTimeout(helloTimeout);
      if (!peer) return;
      const room = rooms.get(peer.payload.sessionId);
      if (!room) return;
      if (room[peer.role]?.socket === socket) delete room[peer.role];
      const other = peer.role === "host" ? room.client : room.host;
      if (other?.socket.readyState === WebSocket.OPEN) send(other.socket, { type: "closed", reason: "peer-disconnected" });
      if (!room.host && !room.client) {
        if (room.expiryTimer) clearTimeout(room.expiryTimer);
        if (room.revalidationTimer) clearInterval(room.revalidationTimer);
        rooms.delete(peer.payload.sessionId);
      }
    });
  });

  return {
    server,
    wss,
    async close() {
      for (const room of rooms.values()) {
        room.host?.socket.close(1001, "server-shutdown");
        room.client?.socket.close(1001, "server-shutdown");
      }
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };

  function closeRoom(sessionId: string, reason: string, code: number) {
    const room = rooms.get(sessionId);
    if (!room) return false;
    if (room.expiryTimer) clearTimeout(room.expiryTimer);
    if (room.revalidationTimer) clearInterval(room.revalidationTimer);
    rooms.delete(sessionId);
    for (const peer of [room.host, room.client]) {
      if (!peer) continue;
      send(peer.socket, { type: "closed", reason });
      peer.socket.close(code, reason);
    }
    return true;
  }

  async function revalidateRoom(sessionId: string) {
    const room = rooms.get(sessionId);
    if (!room) return;
    const peers = [room.host, room.client].filter((peer): peer is Peer => Boolean(peer));
    for (const peer of peers) {
      const authorized = await authorizeChannel(peer.accessToken);
      if (
        !authorized ||
        authorized.sessionId !== sessionId ||
        authorized.deviceId !== peer.payload.deviceId ||
        authorized.mode !== peer.payload.mode ||
        authorized.role !== peer.role ||
        (authorized.audio ?? "off") !== (peer.payload.audio ?? "off")
      ) {
        closeRoom(sessionId, "session-revoked", 1008);
        return;
      }
    }
  }

}

export function startRealtimeServer(listenPort = port) {
  const runtime = createRealtimeServer();
  runtime.server.listen(listenPort, () => console.log(`Remoto realtime running on http://localhost:${listenPort}`));
  return runtime;
}

export function createFrameRateLimiter(
  maxFramesPerSecond: number,
  maxBytesPerSecond: number,
  now: () => number = Date.now
): FrameRateLimiter {
  let windowStartedAt = now();
  let frameCount = 0;
  let byteCount = 0;

  return {
    allow(byteLength) {
      if (!Number.isInteger(byteLength) || byteLength < 0) return false;
      const current = now();
      if (current - windowStartedAt >= 1_000) {
        windowStartedAt = current;
        frameCount = 0;
        byteCount = 0;
      }
      if (frameCount + 1 > maxFramesPerSecond || byteCount + byteLength > maxBytesPerSecond) return false;
      frameCount += 1;
      byteCount += byteLength;
      return true;
    }
  };
}

export function createEventRateLimiter(maxEventsPerSecond: number, now: () => number = Date.now): EventRateLimiter {
  let windowStartedAt = now();
  let eventCount = 0;

  return {
    allow() {
      const current = now();
      if (current - windowStartedAt >= 1_000) {
        windowStartedAt = current;
        eventCount = 0;
      }
      if (eventCount + 1 > maxEventsPerSecond) return false;
      eventCount += 1;
      return true;
    }
  };
}

export interface RelayQualitySnapshot {
  relayDroppedFrames: number;
  relayDroppedBytes: number;
}

export interface RelayQualityTracker {
  recordDrop(byteLength: number): RelayQualitySnapshot | undefined;
}

export function createRelayQualityTracker(now: () => number = Date.now): RelayQualityTracker {
  let droppedFrames = 0;
  let droppedBytes = 0;
  let lastPublishedAt = Number.NEGATIVE_INFINITY;

  return {
    recordDrop(byteLength) {
      if (!Number.isInteger(byteLength) || byteLength < 0) return undefined;
      droppedFrames += 1;
      droppedBytes += byteLength;
      const current = now();
      if (current - lastPublishedAt < 1_000) return undefined;
      lastPublishedAt = current;
      return { relayDroppedFrames: droppedFrames, relayDroppedBytes: droppedBytes };
    }
  };
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function close(socket: WebSocket, reason: string) {
  socket.close(1008, reason.slice(0, 120));
}

function positiveLimit(rawValue: string | undefined, fallback: number) {
  const value = Number(rawValue ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clientAddress(request: http.IncomingMessage) {
  if (trustProxyClientIp) {
    const forwarded = request.headers["x-remoto-client-ip"];
    if (typeof forwarded === "string" && forwarded.trim()) return forwarded.trim().slice(0, 128);
  }
  return request.socket.remoteAddress ?? "unknown";
}

function secretsMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function authorizeChannel(accessToken: string) {
  if (!internalSecret) return null;
  try {
    const response = await fetch(`${apiUrl}/desktop-sessions/authorize-channel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Realtime-Secret": internalSecret
      },
      body: JSON.stringify({ accessToken }),
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return null;
    return await response.json() as { sessionId: string; deviceId: string; mode: "support" | "game"; role: "host" | "client"; audio?: "off" | "system"; remoteId?: string; expiresAt?: string };
  } catch {
    return null;
  }
}

function toBuffer(data: RawData) {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}
