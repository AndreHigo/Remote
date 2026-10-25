import http from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { maxControlMessageBytes, parseControlMessage, verifyChannelToken, type ChannelTokenPayload, type ServerMessage, type SessionRole } from "./protocol.js";

const port = Number(process.env.REALTIME_PORT ?? 4200);
const maxFrameBytes = Number(process.env.REALTIME_MAX_FRAME_BYTES ?? 8 * 1024 * 1024);
const apiUrl = process.env.REALTIME_API_URL ?? "http://localhost:4100";
const internalSecret = process.env.REALTIME_INTERNAL_SECRET;

interface Peer {
  socket: WebSocket;
  payload: ChannelTokenPayload;
  role: SessionRole;
}

interface Room {
  host?: Peer;
  client?: Peer;
}

const rooms = new Map<string, Room>();
const server = http.createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify({ ok: true, service: "remoto-realtime" }));
});
const wss = new WebSocketServer({ server, maxPayload: Math.max(maxFrameBytes, maxControlMessageBytes()) });

wss.on("connection", (socket, request) => {
  let peer: Peer | null = null;
  const sessionId = new URL(request.url ?? "/", "http://localhost").pathname.split("/").filter(Boolean)[1];
  const helloTimeout = setTimeout(() => close(socket, "hello-timeout"), 5000);

  socket.on("message", async (data, isBinary) => {
    if (!peer) {
      if (isBinary) return close(socket, "hello-required");
      const hello = parseControlMessage(toBuffer(data));
      if (!hello || hello.type !== "hello") return close(socket, "hello-required");
      const payload = verifyChannelToken(hello.accessToken);
      if (!payload || payload.sessionId !== sessionId) return close(socket, "invalid-session-token");

      const authorized = await authorizeChannel(hello.accessToken);
      if (!authorized || authorized.sessionId !== payload.sessionId || authorized.deviceId !== payload.deviceId || authorized.mode !== payload.mode) {
        return close(socket, "channel-not-authorized");
      }

      const room = rooms.get(payload.sessionId) ?? {};
      if (room[payload.role]) return close(socket, "role-already-connected");
      peer = { socket, payload, role: payload.role };
      room[payload.role] = peer;
      rooms.set(payload.sessionId, room);
      clearTimeout(helloTimeout);
      send(socket, { type: "ready", sessionId: payload.sessionId, mode: payload.mode, peerConnected: Boolean(room.host && room.client) });
      const other = payload.role === "host" ? room.client : room.host;
      if (other) send(other.socket, { type: "ready", sessionId: payload.sessionId, mode: payload.mode, peerConnected: true });
      return;
    }

    if (isBinary) {
      const frame = toBuffer(data);
      if (peer.role !== "host" || frame.byteLength > maxFrameBytes) return close(socket, "frame-too-large-or-role-not-allowed");
      const client = rooms.get(peer.payload.sessionId)?.client;
      if (client?.socket.readyState === WebSocket.OPEN) client.socket.send(frame, { binary: true });
      return;
    }

    const message = parseControlMessage(toBuffer(data));
    if (!message) return close(socket, "invalid-control-message");
    if (message.type === "ping") {
      send(socket, { type: "pong" });
      return;
    }
    if (message.type === "input") {
      if (peer.role !== "client") return close(socket, "input-role-not-allowed");
      const host = rooms.get(peer.payload.sessionId)?.host;
      if (host?.socket.readyState === WebSocket.OPEN) host.socket.send(JSON.stringify(message));
    }
  });

  socket.on("close", () => {
    clearTimeout(helloTimeout);
    if (!peer) return;
    const room = rooms.get(peer.payload.sessionId);
    if (!room) return;
    if (room[peer.role]?.socket === socket) delete room[peer.role];
    const other = peer.role === "host" ? room.client : room.host;
    if (other?.socket.readyState === WebSocket.OPEN) send(other.socket, { type: "closed", reason: "peer-disconnected" });
    if (!room.host && !room.client) rooms.delete(peer.payload.sessionId);
  });
});

server.listen(port, () => console.log(`Remoto realtime running on http://localhost:${port}`));

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function close(socket: WebSocket, reason: string) {
  socket.close(1008, reason.slice(0, 120));
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
    return await response.json() as { sessionId: string; deviceId: string; mode: "support" | "game"; role: "host" | "client"; remoteId?: string; expiresAt?: string };
  } catch {
    return null;
  }
}

function toBuffer(data: RawData) {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}
