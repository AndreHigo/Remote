import assert from "node:assert/strict";
import test from "node:test";
import { buildInteractiveSessionCapability, parseInteractiveSessionProbe } from "./session-capability.js";

test("interpreta a sondagem do PowerShell sem aceitar valores frouxos", () => {
  assert.deepEqual(parseInteractiveSessionProbe('{"taskInstalled":true,"processRunning":true}'), {
    taskInstalled: true,
    processRunning: true
  });
  assert.deepEqual(parseInteractiveSessionProbe('{"taskInstalled":1,"processRunning":"true"}'), {
    taskInstalled: false,
    processRunning: false
  });
  assert.deepEqual(parseInteractiveSessionProbe(""), {
    taskInstalled: false,
    processRunning: false
  });
});

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
