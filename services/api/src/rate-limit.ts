import crypto from "node:crypto";
import { createClient } from "redis";
import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
  maxEntries?: number;
  key?: (request: Request) => string;
  redisUrl?: string;
  failClosed?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

type RateLimitRedisClient = ReturnType<typeof createClient>;

const redisClients = new Map<string, RateLimitRedisClient>();
const REDIS_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "return { count, redis.call('PTTL', KEYS[1]) }"
].join("\n");

export function createRateLimiter(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();
  const maxEntries = options.maxEntries ?? 10_000;
  const redisUrl = options.redisUrl ?? process.env.REDIS_URL;
  const failClosed = options.failClosed ?? process.env.NODE_ENV === "production";
  let fallbackWarningShown = false;
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }, options.windowMs);
  cleanup.unref();

  return async (request: Request, response: Response, next: NextFunction) => {
    const rawKey = options.key?.(request) ?? request.ip ?? request.socket.remoteAddress ?? "unknown";
    let entry: RateLimitEntry;

    try {
      entry = redisUrl
        ? await consumeRedis(redisUrl, options.name, rawKey, options.windowMs)
        : consumeMemory(entries, maxEntries, rawKey, options.windowMs);
    } catch (error) {
      if (redisUrl && failClosed) {
        response.status(503).json({ code: "rate_limit_unavailable", message: "Protecao temporariamente indisponivel. Tente novamente." });
        return;
      }

      if (redisUrl && !fallbackWarningShown) {
        fallbackWarningShown = true;
        console.warn(`Rate limit ${options.name} usando fallback local: ${error instanceof Error ? error.message : String(error)}`);
      }
      entry = consumeMemory(entries, maxEntries, rawKey, options.windowMs);
    }

    const now = Date.now();
    response.setHeader(`RateLimit-${options.name}-Limit`, options.max);
    response.setHeader(`RateLimit-${options.name}-Remaining`, Math.max(0, options.max - entry.count));
    response.setHeader(`RateLimit-${options.name}-Reset`, Math.ceil(Math.max(0, entry.resetAt - now) / 1000));

    if (entry.count > options.max) {
      response.setHeader("Retry-After", Math.ceil(Math.max(0, entry.resetAt - now) / 1000));
      response.status(429).json({ message: "Limite temporario atingido. Tente novamente em alguns instantes." });
      return;
    }

    next();
  };
}

export async function getRateLimitStoreStatus(): Promise<"redis" | "memory" | "unavailable"> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return process.env.NODE_ENV === "production" ? "unavailable" : "memory";

  try {
    const client = getRedisClient(redisUrl);
    if (!client.isOpen) await client.connect();
    await client.ping();
    return "redis";
  } catch {
    return "unavailable";
  }
}

function consumeMemory(entries: Map<string, RateLimitEntry>, maxEntries: number, key: string, windowMs: number) {
  const now = Date.now();
  const current = entries.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + windowMs }
    : { count: current.count + 1, resetAt: current.resetAt };

  if (!entries.has(key) && entries.size >= maxEntries) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey) entries.delete(oldestKey);
  }
  entries.set(key, entry);
  return entry;
}

async function consumeRedis(redisUrl: string, name: string, rawKey: string, windowMs: number): Promise<RateLimitEntry> {
  const client = getRedisClient(redisUrl);
  if (!client.isOpen) await client.connect();

  const digest = crypto.createHash("sha256").update(`${name}:${rawKey}`).digest("hex");
  const result = await client.sendCommand(["EVAL", REDIS_WINDOW_SCRIPT, "1", `remoto:ratelimit:${name}:${digest}`, String(windowMs)]) as unknown;
  if (!Array.isArray(result) || result.length < 2) throw new Error("Resposta invalida do Redis");

  const count = Number(result[0]);
  const ttlMs = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs) || count < 1 || ttlMs < 0) throw new Error("Contador invalido do Redis");
  return { count, resetAt: Date.now() + ttlMs };
}

function getRedisClient(redisUrl: string) {
  const existing = redisClients.get(redisUrl);
  if (existing) return existing;

  const client = createClient({ url: redisUrl });
  client.on("error", () => undefined);
  redisClients.set(redisUrl, client);
  return client;
}
