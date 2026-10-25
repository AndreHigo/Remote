const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildElectronBuilderArgs, writeOperatorConfig } = require("./package-windows.cjs");

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

test("configuracao do operador exige os dois endpoints e nao grava token", () => {
  const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "remoto-operator-config-"));
  try {
    assert.throws(
      () => writeOperatorConfig({ REMOTO_OPERATOR_API_URL: "https://api.example.com" }, rootDirectory),
      /juntos/
    );

    const result = writeOperatorConfig({
      REMOTO_OPERATOR_API_URL: "https://api.example.com",
      REMOTO_OPERATOR_REALTIME_URL: "wss://relay.example.com/realtime",
      ACCESS_TOKEN: "nao-deve-ser-lido"
    }, rootDirectory);
    assert.deepEqual(result, {
      apiUrl: "https://api.example.com",
      realtimeUrl: "wss://relay.example.com/realtime"
    });
    const config = JSON.parse(fs.readFileSync(path.join(rootDirectory, "build", "operator-config.json"), "utf8"));
    assert.deepEqual(config, result);
    assert.equal(JSON.stringify(config).includes("nao-deve-ser-lido"), false);
  } finally {
    fs.rmSync(rootDirectory, { recursive: true, force: true });
  }
});
