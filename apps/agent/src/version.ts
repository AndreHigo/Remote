declare const __REMOTO_AGENT_VERSION__: string | undefined;

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;

export function resolveAgentVersion(environment: { REMOTO_AGENT_VERSION?: string } = process.env) {
  const candidate = environment.REMOTO_AGENT_VERSION?.trim();
  return candidate && SEMVER.test(candidate) ? candidate : "0.1.0";
}

const compiledVersion = typeof __REMOTO_AGENT_VERSION__ === "string" ? __REMOTO_AGENT_VERSION__ : undefined;
export const AGENT_VERSION = resolveAgentVersion({
  REMOTO_AGENT_VERSION: compiledVersion ?? process.env.REMOTO_AGENT_VERSION
});
