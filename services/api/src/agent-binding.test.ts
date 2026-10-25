import assert from "node:assert/strict";
import test from "node:test";
import { isAgentRemoteIdAllowed, isAgentRemoteIdClaimAllowed } from "./agent-binding.js";

test("permite o primeiro cadastro e repeticoes do mesmo computador", () => {
  assert.equal(isAgentRemoteIdAllowed(null, "rustdesk-123"), true);
  assert.equal(isAgentRemoteIdAllowed("rustdesk-123", "rustdesk-123"), true);
});

test("bloqueia a reutilizacao da chave em outro computador", () => {
  assert.equal(isAgentRemoteIdAllowed("rustdesk-123", "rustdesk-456"), false);
});

test("chave nova nao pode assumir computador ja cadastrado", () => {
  assert.equal(isAgentRemoteIdClaimAllowed(null, "rustdesk-123", "rustdesk-123"), false);
  assert.equal(isAgentRemoteIdClaimAllowed(null, null, "rustdesk-123"), true);
  assert.equal(isAgentRemoteIdClaimAllowed("rustdesk-123", "rustdesk-123", "rustdesk-123"), true);
});
