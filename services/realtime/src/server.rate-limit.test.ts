import assert from "node:assert/strict";
import test from "node:test";
import { createFrameRateLimiter } from "./server.js";

test("relay limita frames e bytes por janela e reseta o orcamento", () => {
  let now = 0;
  const limiter = createFrameRateLimiter(2, 10, () => now);

  assert.equal(limiter.allow(4), true);
  assert.equal(limiter.allow(6), true);
  assert.equal(limiter.allow(0), false);

  now = 999;
  assert.equal(limiter.allow(1), false);
  now = 1_000;
  assert.equal(limiter.allow(10), true);
  assert.equal(limiter.allow(1), false);
});
