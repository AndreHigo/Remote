import assert from "node:assert/strict";
import test from "node:test";
import { isCompletedLogin } from "./auth.js";

test("nao considera o desafio TOTP uma sessao concluida", () => {
  assert.equal(isCompletedLogin({ requiresTwoFactor: true, user: {
    id: "user-1",
    workspaceId: "workspace-1",
    name: "Owner",
    email: "owner@example.com",
    role: "owner"
  } }), false);
});

test("considera concluido somente o login que recebeu token", () => {
  assert.equal(isCompletedLogin({ user: {
    id: "user-1",
    workspaceId: "workspace-1",
    name: "Owner",
    email: "owner@example.com",
    role: "owner"
  }, token: "signed-token" }), true);
});
