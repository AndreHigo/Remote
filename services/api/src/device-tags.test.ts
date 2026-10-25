import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDeviceTags } from "./device-tags.js";

test("normaliza etiquetas, remove duplicadas e preserva a primeira grafia", () => {
  assert.deepEqual(normalizeDeviceTags([" Financeiro ", "financeiro", "Critico", "", "Servidor"]), [
    "Financeiro",
    "Critico",
    "Servidor"
  ]);
});

test("limita a quantidade de etiquetas", () => {
  const tags = Array.from({ length: 25 }, (_, index) => `tag-${index}`);
  assert.equal(normalizeDeviceTags(tags).length, 20);
});
