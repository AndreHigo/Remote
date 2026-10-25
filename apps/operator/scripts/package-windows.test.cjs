const assert = require("node:assert/strict");
const test = require("node:test");
const { buildElectronBuilderArgs } = require("./package-windows.cjs");

test("empacotamento do operador propaga a versao da release", () => {
  assert.deepEqual(buildElectronBuilderArgs({ REMOTO_RELEASE_VERSION: "0.2.0" }), [
    "--win",
    "nsis",
    "--config.extraMetadata.version=0.2.0"
  ]);
});

test("empacotamento aceita diretorio isolado para homologacao", () => {
  assert.deepEqual(buildElectronBuilderArgs({ REMOTO_RELEASE_VERSION: "1.2.3-rc.1", REMOTO_OUTPUT_DIR: "release-test" }), [
    "--win",
    "nsis",
    "--config.extraMetadata.version=1.2.3-rc.1",
    "--config.directories.output=release-test"
  ]);
});

test("empacotamento rejeita versao fora de SemVer", () => {
  assert.throws(() => buildElectronBuilderArgs({ REMOTO_RELEASE_VERSION: "v0.2.0" }), /invalida/);
});
