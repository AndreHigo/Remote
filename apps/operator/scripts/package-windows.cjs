const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;

function buildElectronBuilderArgs(environment = process.env) {
  const args = ["--win", "nsis"];
  const version = String(environment.REMOTO_RELEASE_VERSION || "").trim();
  if (version) {
    if (!SEMVER.test(version)) throw new Error(`REMOTO_RELEASE_VERSION invalida: ${version}`);
    args.push(`--config.extraMetadata.version=${version}`);
  }
  const outputDirectory = String(environment.REMOTO_OUTPUT_DIR || "").trim();
  if (outputDirectory) args.push(`--config.directories.output=${outputDirectory}`);
  return args;
}

function writeOperatorConfig(environment = process.env, rootDirectory = process.cwd()) {
  const apiUrl = String(environment.REMOTO_OPERATOR_API_URL || environment.REMOTO_API_URL || "").trim();
  const realtimeUrl = String(environment.REMOTO_OPERATOR_REALTIME_URL || environment.REMOTO_REALTIME_URL || "").trim();
  if ((apiUrl && !realtimeUrl) || (!apiUrl && realtimeUrl)) {
    throw new Error("Configure REMOTO_OPERATOR_API_URL e REMOTO_OPERATOR_REALTIME_URL juntos.");
  }
  const buildDirectory = path.resolve(rootDirectory, "build");
  fs.mkdirSync(buildDirectory, { recursive: true });
  fs.writeFileSync(path.join(buildDirectory, "operator-config.json"), JSON.stringify({ apiUrl, realtimeUrl }, null, 2));
  return { apiUrl, realtimeUrl };
}

if (require.main === module) {
  writeOperatorConfig();
  const electronBuilderCli = require.resolve("electron-builder/cli");
  const result = spawnSync(process.execPath, [electronBuilderCli, ...buildElectronBuilderArgs()], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

module.exports = { buildElectronBuilderArgs, writeOperatorConfig };
