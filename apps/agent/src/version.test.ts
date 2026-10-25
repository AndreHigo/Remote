import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentVersion } from "./version.js";

test("aceita versao SemVer injetada no pacote", () => {
  assert.equal(resolveAgentVersion({ REMOTO_AGENT_VERSION: "0.2.0" }), "0.2.0");
  assert.equal(resolveAgentVersion({ REMOTO_AGENT_VERSION: "1.2.3-rc.1" }), "1.2.3-rc.1");
});

test("usa fallback seguro para versao ausente ou invalida", () => {
  assert.equal(resolveAgentVersion({}), "0.1.0");
  assert.equal(resolveAgentVersion({ REMOTO_AGENT_VERSION: "v0.2.0" }), "0.1.0");
  assert.equal(resolveAgentVersion({ REMOTO_AGENT_VERSION: "latest" }), "0.1.0");
});
