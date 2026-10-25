import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
  maxEntries?: number;
  key?: (request: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();
  const maxEntries = options.maxEntries ?? 10_000;
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }, options.windowMs);
  cleanup.unref();

  return (request: Request, response: Response, next: NextFunction) => {
    const key = options.key?.(request) ?? request.ip ?? request.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const current = entries.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 1, resetAt: now + options.windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };

    if (!entries.has(key) && entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey) entries.delete(oldestKey);
    }
    entries.set(key, entry);
    response.setHeader(`RateLimit-${options.name}-Limit`, options.max);
    response.setHeader(`RateLimit-${options.name}-Remaining`, Math.max(0, options.max - entry.count));
    response.setHeader(`RateLimit-${options.name}-Reset`, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > options.max) {
      response.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      response.status(429).json({ message: "Limite temporario atingido. Tente novamente em alguns instantes." });
      return;
    }

    next();
  };
}
