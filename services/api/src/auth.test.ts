import assert from "node:assert/strict";
import test from "node:test";
import { isCompletedLogin, shouldRequireOperationalMfa } from "./auth.js";

test("MFA operacional bloqueia tecnico sem 2FA fora da configuracao", () => {
  assert.equal(shouldRequireOperationalMfa({ role: "technician", twoFactorEnabled: false, path: "/devices", enforced: true }), true);
  assert.equal(shouldRequireOperationalMfa({ role: "technician", twoFactorEnabled: false, path: "/auth/2fa/status", enforced: true }), false);
  assert.equal(shouldRequireOperationalMfa({ role: "technician", twoFactorEnabled: false, path: "/auth/me", enforced: true }), false);
  assert.equal(shouldRequireOperationalMfa({ role: "technician", twoFactorEnabled: false, path: "/auth/logout", enforced: true }), false);
  assert.equal(shouldRequireOperationalMfa({ role: "viewer", twoFactorEnabled: false, path: "/devices", enforced: true }), false);
  assert.equal(shouldRequireOperationalMfa({ role: "technician", twoFactorEnabled: true, path: "/devices", enforced: true }), false);
});

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
