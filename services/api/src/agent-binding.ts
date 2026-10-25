export function isAgentRemoteIdAllowed(boundRemoteId: string | null, remoteId: string) {
  return boundRemoteId === null || boundRemoteId === remoteId;
}
