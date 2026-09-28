export type DeviceStatus = "online" | "offline";
export type RemoteSessionStatus = "requested" | "approved" | "denied" | "ended";
export type UserRole = "owner" | "admin" | "technician" | "viewer";
export type CommandExecutionStatus = "pending" | "running" | "succeeded" | "failed";
export type CommandType = "ping" | "system-info" | "refresh-inventory";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  name: string;
  document: string;
  contactName: string;
  contactEmail: string;
}

export interface Device {
  id: string;
  customerId: string;
  displayName: string;
  remoteId: string;
  os: string;
  userName: string;
  localIp: string;
  biosSerial: string | null;
  systemUuid: string | null;
  primaryMac: string | null;
  identityHash: string | null;
  tags: string[];
  lastSeenAt: string | null;
  createdAt: string;
}

export interface RemoteSession {
  id: string;
  deviceId: string;
  userId: string | null;
  technicianName: string;
  reason: string;
  status: RemoteSessionStatus;
  requestedAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  targetId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface CommandExecutionView {
  id: string;
  deviceId: string;
  commandType: string;
  status: CommandExecutionStatus;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  payload: unknown;
  output: unknown;
  error: string | null;
}

export interface DeviceView extends Device {
  status: DeviceStatus;
  customerName: string;
  secondsSinceLastSeen: number | null;
}
