import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";
import { createRateLimiter } from "./rate-limit.js";

test("rate limit local bloqueia somente depois do teto", async () => {
  const limiter = createRateLimiter({ name: "Test", windowMs: 60_000, max: 2, redisUrl: "" });
  const response = createResponse();
  const request = { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } } as never;
  let nextCalls = 0;

  await limiter(request, response as unknown as Response, () => { nextCalls += 1; });
  await limiter(request, response as unknown as Response, () => { nextCalls += 1; });
  await limiter(request, response as unknown as Response, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["RateLimit-Test-Remaining"], 0);
});

function createResponse() {
  const headers: Record<string, string | number> = {};
  return {
    headers,
    statusCode: 200,
    setHeader(name: string, value: string | number) {
      headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  } as TestResponse;
}

interface TestResponse {
    headers: Record<string, string | number>;
    statusCode: number;
    setHeader(name: string, value: string | number): void;
    status(code: number): unknown;
    json(value?: unknown): unknown;
}
