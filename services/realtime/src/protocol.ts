import crypto from "node:crypto";

export type SessionMode = "support" | "game";
export type SessionRole = "host" | "client";

export interface ChannelTokenPayload {
  sessionId: string;
  deviceId: string;
  mode: SessionMode;
  role: SessionRole;
  audio?: "off" | "system";
  remoteId?: string;
  nonce: string;
  exp: number;
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

export interface MonitorMapMessage {
  type: "monitors";
  monitors: RealtimeMonitor[];
  activeIndex?: number;
}

export type ClientMessage =
  | { type: "hello"; accessToken: string }
  | { type: "input"; event: Record<string, unknown> }
  | { type: "monitor"; index: number }
  | MonitorMapMessage
  | { type: "ping"; sentAt?: number };

export type ServerMessage =
  | { type: "ready"; sessionId: string; mode: SessionMode; peerConnected: boolean }
  | MonitorMapMessage
  | { type: "pong"; sentAt?: number }
  | { type: "quality"; relayDroppedFrames: number; relayDroppedBytes: number }
  | { type: "closed"; reason: string };

const TOKEN_SECRET = process.env.DESKTOP_SESSION_SECRET ?? process.env.JWT_SECRET ?? crypto.randomBytes(32).toString("hex");
const MAX_CONTROL_MESSAGE_BYTES = 64 * 1024;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function parseMonitorMap(value: unknown, activeIndexValue?: unknown): MonitorMapMessage | null {
  if (!Array.isArray(value) || value.length > 16) return null;
  const monitors = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const monitor = item as Record<string, unknown>;
    if (
      !isIntegerInRange(monitor.index, 0, 16) ||
      typeof monitor.name !== "string" || monitor.name.length === 0 || monitor.name.length > 128 ||
      !isIntegerInRange(monitor.x, -32768, 32767) || !isIntegerInRange(monitor.y, -32768, 32767) ||
      !isIntegerInRange(monitor.width, 1, 16384) || !isIntegerInRange(monitor.height, 1, 16384) ||
      typeof monitor.primary !== "boolean"
    ) return null;
    return {
      index: monitor.index,
      name: monitor.name,
      x: monitor.x,
      y: monitor.y,
      width: monitor.width,
      height: monitor.height,
      primary: monitor.primary
    } satisfies RealtimeMonitor;
  });
  if (monitors.some((monitor) => monitor === null)) return null;
  if (activeIndexValue !== undefined && !isIntegerInRange(activeIndexValue, 0, 16)) return null;
  return {
    type: "monitors",
    monitors: monitors as RealtimeMonitor[],
    ...(activeIndexValue === undefined ? {} : { activeIndex: activeIndexValue })
  };
}

export function isRealtimeInputEvent(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;

  if (event.type === "mouse.relative") {
    return isFiniteNumber(event.dx) && event.dx >= -32768 && event.dx <= 32767 && isFiniteNumber(event.dy) && event.dy >= -32768 && event.dy <= 32767;
  }
  if (event.type === "mouse.button") {
    return (event.button === "left" || event.button === "right" || event.button === "middle") && (event.action === "down" || event.action === "up");
  }
  if (event.type === "mouse.wheel") {
    return isFiniteNumber(event.delta) && event.delta >= -12000 && event.delta <= 12000;
  }
  if (event.type === "key") {
    return isIntegerInRange(event.scanCode, 1, 255) && (event.action === "down" || event.action === "up") && (event.extended === undefined || typeof event.extended === "boolean");
  }
  return false;
}

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
    if (payload.audio !== undefined && !["off", "system"].includes(payload.audio)) return null;
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
    if (value.type === "input" && isRealtimeInputEvent(value.event)) {
      return { type: "input", event: value.event as Record<string, unknown> };
    }
    if (value.type === "monitor" && isIntegerInRange(value.index, 0, 16)) {
      return { type: "monitor", index: value.index };
    }
    if (value.type === "monitors") return parseMonitorMap(value.monitors, value.activeIndex);
    return null;
  } catch {
    return null;
  }
}

export function maxControlMessageBytes() {
  return MAX_CONTROL_MESSAGE_BYTES;
}

export function channelTokenSignatureForTest(body: string) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
}
