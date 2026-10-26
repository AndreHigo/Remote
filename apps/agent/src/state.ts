export interface AgentState {
  deviceId: string;
  remoteId: string;
  displayName: string;
}

export function isValidAgentState(value: unknown): value is AgentState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<AgentState>;
  return [state.deviceId, state.remoteId, state.displayName].every(
    (field) => typeof field === "string" && field.trim().length > 0
  );
}
