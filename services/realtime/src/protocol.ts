import crypto from "node:crypto";

export type SessionMode = "support" | "game";
export type SessionRole = "host" | "client";

export interface ChannelTokenPayload {
  sessionId: string;
  deviceId: string;
  mode: SessionMode;
  role: SessionRole;
  remoteId?: string;
  nonce: string;
  exp: number;
}

export type ClientMessage =
  | { type: "hello"; accessToken: string }
  | { type: "input"; event: Record<string, unknown> }
  | { type: "ping"; sentAt?: number };

export type ServerMessage =
  | { type: "ready"; sessionId: string; mode: SessionMode; peerConnected: boolean }
  | { type: "pong"; sentAt?: number }
  | { type: "closed"; reason: string };

const TOKEN_SECRET = process.env.DESKTOP_SESSION_SECRET ?? process.env.JWT_SECRET ?? "remoto-local-desktop-secret-change-me";
const MAX_CONTROL_MESSAGE_BYTES = 64 * 1024;

export function verifyChannelToken(token: string): ChannelTokenPayload | null {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChannelTokenPayload;
    if (!payload.sessionId || !payload.deviceId || !payload.nonce || payload.exp <= Date.now()) return null;
    if (!["support", "game"].includes(payload.mode) || !["host", "client"].includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseControlMessage(data: Buffer | string): ClientMessage | null {
  const raw = typeof data === "string" ? data : data.toString("utf8");
  if (Buffer.byteLength(raw, "utf8") > MAX_CONTROL_MESSAGE_BYTES) return null;

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.type === "hello" && typeof value.accessToken === "string") {
      return { type: "hello", accessToken: value.accessToken };
    }
    if (value.type === "ping") return typeof value.sentAt === "number" ? { type: "ping", sentAt: value.sentAt } : { type: "ping" };
    if (value.type === "input" && value.event && typeof value.event === "object" && !Array.isArray(value.event)) {
      return { type: "input", event: value.event as Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
}

export function maxControlMessageBytes() {
  return MAX_CONTROL_MESSAGE_BYTES;
}
