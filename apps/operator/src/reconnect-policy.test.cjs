const assert = require("node:assert/strict");
const test = require("node:test");
const { MAX_RECONNECT_ATTEMPTS, getReconnectDelay } = require("./reconnect-policy.cjs");

test("reconexao usa backoff crescente com teto", () => {
  assert.equal(getReconnectDelay(0), 500);
  assert.equal(getReconnectDelay(1), 1_000);
  assert.equal(getReconnectDelay(4), 8_000);
  assert.equal(getReconnectDelay(5), 15_000);
  assert.equal(getReconnectDelay(11), 15_000);
});

test("reconexao permanece disponivel por uma janela maior antes do retry manual", () => {
  assert.equal(MAX_RECONNECT_ATTEMPTS, 12);
  assert.throws(() => getReconnectDelay(-1), /invalida/);
  assert.throws(() => getReconnectDelay(1.5), /invalida/);
});
