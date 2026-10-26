import assert from "node:assert/strict";
import test from "node:test";
import { buildInteractiveSessionCapability } from "./session-capability.js";

test("agente interativo nao exige tarefa agendada durante desenvolvimento", () => {
  assert.deepEqual(buildInteractiveSessionCapability({
    platform: "win32",
    serviceMode: false,
    taskInstalled: false,
    processRunning: false
  }), {
    interactiveSessionReady: true,
    interactiveTaskInstalled: false,
    interactiveProcessRunning: false
  });
});

test("servico exige tarefa e processo interativos para modo jogo", () => {
  assert.equal(buildInteractiveSessionCapability({
    platform: "win32",
    serviceMode: true,
    taskInstalled: true,
    processRunning: false
  }).interactiveSessionReady, false);
  assert.equal(buildInteractiveSessionCapability({
    platform: "win32",
    serviceMode: true,
    taskInstalled: true,
    processRunning: true
  }).interactiveSessionReady, true);
});

test("plataforma sem desktop Windows nao fica pronta para captura interativa", () => {
  assert.equal(buildInteractiveSessionCapability({
    platform: "linux",
    serviceMode: false,
    taskInstalled: false,
    processRunning: false
  }).interactiveSessionReady, false);
});
