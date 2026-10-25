const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadMedia() {
  const source = fs.readFileSync(path.join(__dirname, "media.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  return context.globalThis.remotoMedia;
}

test("seleciona o primeiro MIME H.264 aceito pelo MSE", () => {
  const media = loadMedia();
  assert.equal(media.selectH264Mime((mime) => mime.includes("4D401F")), 'video/mp4; codecs="avc1.4D401F"');
});

test("informa quando o ambiente nao aceita nenhum perfil H.264", () => {
  const media = loadMedia();
  assert.equal(media.selectH264Mime(() => false), null);
});
