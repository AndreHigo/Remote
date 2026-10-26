import fs from "node:fs";
import path from "node:path";

export function getAgentInstallerPath(environment: NodeJS.ProcessEnv = process.env): string | null {
  const configuredPath = environment.REMOTO_AGENT_INSTALLER_PATH?.trim();
  if (!configuredPath) return null;

  const resolvedPath = path.resolve(configuredPath);
  try {
    return fs.statSync(resolvedPath).isFile() ? resolvedPath : null;
  } catch {
    return null;
  }
}
