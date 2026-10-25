import { validateEndpointUrl } from "./url-policy.js";

export interface AgentEndpointFileConfig {
  apiUrl?: string;
  realtimeUrl?: string;
}

export interface AgentEndpoints {
  apiUrl: string;
  realtimeUrl: string;
}

export function resolveAgentEndpoints(
  fileConfig: AgentEndpointFileConfig,
  environment: NodeJS.ProcessEnv = process.env
): AgentEndpoints {
  const serviceMode = environment.REMOTO_AGENT_SERVICE === "1";
  const apiRaw = environment.REMOTO_API_URL ?? fileConfig.apiUrl;
  const realtimeRaw = environment.REMOTO_REALTIME_URL ?? fileConfig.realtimeUrl;

  if (serviceMode && !apiRaw) {
    throw new Error("apiUrl ausente na configuracao do servico. Informe REMOTO_API_URL ou preencha apiUrl.");
  }
  if (serviceMode && !realtimeRaw) {
    throw new Error("realtimeUrl ausente na configuracao do servico. Informe REMOTO_REALTIME_URL ou preencha realtimeUrl.");
  }

  return {
    apiUrl: validateEndpointUrl(apiRaw ?? "http://localhost:4100", "api"),
    realtimeUrl: validateEndpointUrl(realtimeRaw ?? "ws://localhost:4200", "realtime")
  };
}
