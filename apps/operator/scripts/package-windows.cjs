const { spawnSync } = require("node:child_process");

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

if (require.main === module) {
  const electronBuilderCli = require.resolve("electron-builder/cli");
  const result = spawnSync(process.execPath, [electronBuilderCli, ...buildElectronBuilderArgs()], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

module.exports = { buildElectronBuilderArgs };
