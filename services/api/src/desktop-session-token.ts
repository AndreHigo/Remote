import crypto from "node:crypto";
import type { RemoteSessionMode } from "./domain.js";

const TOKEN_TTL_MS = 5 * 60 * 1000;
const TOKEN_SECRET = process.env.DESKTOP_SESSION_SECRET ?? process.env.JWT_SECRET ?? crypto.randomBytes(32).toString("hex");

export interface DesktopSessionTokenPayload {
  sessionId: string;
  deviceId: string;
  mode: RemoteSessionMode;
  role: "client" | "host";
  audio?: "off" | "system";
  remoteId?: string;
  monitorIndex?: number;
  nonce: string;
  exp: number;
}

export function createDesktopSessionToken(input: Omit<DesktopSessionTokenPayload, "nonce" | "exp">) {
  const payload: DesktopSessionTokenPayload = {
    ...input,
    nonce: crypto.randomBytes(18).toString("base64url"),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const body = encode(payload);
  const signature = sign(body);
  const token = `${body}.${signature}`;

  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(payload.exp),
    payload
  };
}

export function verifyDesktopSessionToken(token: string): DesktopSessionTokenPayload | null {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = sign(body);
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DesktopSessionTokenPayload;
    if (!payload.sessionId || !payload.deviceId || !payload.nonce || payload.exp <= Date.now()) return null;
    if (!["support", "game"].includes(payload.mode) || !["client", "host"].includes(payload.role)) return null;
    if (payload.audio !== undefined && !["off", "system"].includes(payload.audio)) return null;
    if (payload.monitorIndex !== undefined && (!Number.isInteger(payload.monitorIndex) || payload.monitorIndex < 0 || payload.monitorIndex > 16)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sign(body: string) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
