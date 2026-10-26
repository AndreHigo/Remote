import assert from "node:assert/strict";
import test from "node:test";
import { buildInputCapabilities } from "./input-capability.js";

test("publica o mapa de entrada sem prometer gamepad virtual", () => {
  assert.deepEqual(buildInputCapabilities(), {
    keyboard: "sendinput",
    mouse: "sendinput",
    gamepad: "keyboard-mouse-map",
    virtualGamepad: false,
    haptics: false
  });
});
