export function isAgentRemoteIdAllowed(boundRemoteId: string | null, remoteId: string) {
  return boundRemoteId === null || boundRemoteId === remoteId;
}

export function isAgentRemoteIdClaimAllowed(
  boundRemoteId: string | null,
  existingDeviceRemoteId: string | null,
  requestedRemoteId: string
) {
  if (boundRemoteId !== null) return boundRemoteId === requestedRemoteId;
  return existingDeviceRemoteId === null;
}
