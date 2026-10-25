import assert from "node:assert/strict";
import test from "node:test";
import { validateEndpointUrl } from "./url-policy.js";

test("permite transporte sem TLS somente em loopback", () => {
  assert.equal(validateEndpointUrl("http://localhost:4100/", "api"), "http://localhost:4100");
  assert.equal(validateEndpointUrl("ws://127.0.0.1:4200/", "realtime"), "ws://127.0.0.1:4200");
});

test("exige TLS fora de loopback", () => {
  assert.throws(() => validateEndpointUrl("http://remote.example.com", "api"), /insegura/);
  assert.throws(() => validateEndpointUrl("ws://remote.example.com", "realtime"), /insegura/);
  assert.equal(validateEndpointUrl("https://remote.example.com/api", "api"), "https://remote.example.com/api");
  assert.equal(validateEndpointUrl("wss://remote.example.com/realtime", "realtime"), "wss://remote.example.com/realtime");
});

test("rejeita credenciais embutidas na URL", () => {
  assert.throws(() => validateEndpointUrl("https://user:secret@example.com", "api"), /credenciais/);
});
