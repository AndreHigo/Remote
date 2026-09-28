import assert from "node:assert/strict";
import test from "node:test";
import { decryptTotpSecret, encryptTotpSecret, generateTotpSecret, verifyTotp } from "./totp.js";

test("verifica codigos TOTP RFC 6238 com janela de relogio", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const vectors = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"]
  ] as const;

  for (const [timestamp, code] of vectors) {
    assert.equal(verifyTotp(secret, code, timestamp * 1000), true);
  }
  assert.equal(verifyTotp(secret, "000000", 59 * 1000), false);
});

test("gera segredo e cifra o valor armazenado", () => {
  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptTotpSecret(encrypted), secret);
});
