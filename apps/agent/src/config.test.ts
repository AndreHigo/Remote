import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentEndpoints } from "./config.js";

test("mantem os padroes localhost fora do servico", () => {
  assert.deepEqual(resolveAgentEndpoints({}, {}), {
    apiUrl: "http://localhost:4100",
    realtimeUrl: "ws://localhost:4200"
  });
});

test("exige API e relay explicitos quando executado como servico", () => {
  assert.throws(
    () => resolveAgentEndpoints({ apiUrl: "https://api.example.com" }, { REMOTO_AGENT_SERVICE: "1" }),
    /realtimeUrl ausente/
  );
  assert.throws(
    () => resolveAgentEndpoints({ realtimeUrl: "wss://relay.example.com" }, { REMOTO_AGENT_SERVICE: "1" }),
    /apiUrl ausente/
  );
});

test("resolve os enderecos do arquivo e permite sobrescrita pelo ambiente", () => {
  assert.deepEqual(resolveAgentEndpoints(
    { apiUrl: "https://file-api.example.com", realtimeUrl: "wss://file-relay.example.com" },
    { REMOTO_AGENT_SERVICE: "1", REMOTO_API_URL: "https://env-api.example.com" }
  ), {
    apiUrl: "https://env-api.example.com",
    realtimeUrl: "wss://file-relay.example.com"
  });
});
