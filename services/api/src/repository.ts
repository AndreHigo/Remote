import crypto from "node:crypto";
import type { AuthUser, CommandType, DeviceView, RemoteSessionMode } from "./domain.js";
import type { Prisma } from "./generated/prisma/client.js";
import { prisma } from "./db.js";
import { hashPassword } from "./password.js";
import { createDesktopSessionToken, hashToken, verifyDesktopSessionToken } from "./desktop-session-token.js";

const ONLINE_WINDOW_MS = 90_000;

function now() {
  return new Date();
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function getStatus(lastSeenAt: Date | null) {
  if (!lastSeenAt) return { status: "offline" as const, secondsSinceLastSeen: null };

  const diffMs = Date.now() - lastSeenAt.getTime();
  return {
    status: diffMs <= ONLINE_WINDOW_MS ? ("online" as const) : ("offline" as const),
    secondsSinceLastSeen: Math.max(0, Math.round(diffMs / 1000))
  };
}

function toDeviceView(
  device: Awaited<ReturnType<typeof prisma.device.findMany>>[number] & {
    customer: { name: string };
  }
): DeviceView {
  return {
    id: device.id,
    customerId: device.customerId,
    customerName: device.customer.name,
    displayName: device.displayName,
    remoteId: device.remoteId,
    os: device.os,
    userName: device.userName,
    localIp: device.localIp,
    biosSerial: device.biosSerial,
    systemUuid: device.systemUuid,
    primaryMac: device.primaryMac,
    identityHash: device.identityHash,
    tags: device.tags,
    lastSeenAt: toIso(device.lastSeenAt),
    createdAt: device.createdAt.toISOString(),
    ...getStatus(device.lastSeenAt)
  };
}

function toCommandView(command: Awaited<ReturnType<typeof prisma.commandExecution.findMany>>[number]) {
  return {
    ...command,
    status: command.status.toLowerCase(),
    requestedAt: command.requestedAt.toISOString(),
    startedAt: toIso(command.startedAt),
    completedAt: toIso(command.completedAt)
  };
}

function toRemoteSessionView(session: {
  id: string;
  deviceId: string;
  userId: string | null;
  technicianName: string;
  reason: string;
  mode: string;
  status: string;
  requestedAt: Date;
  endedAt: Date | null;
}) {
  return {
    id: session.id,
    deviceId: session.deviceId,
    userId: session.userId,
    technicianName: session.technicianName,
    reason: session.reason,
    mode: session.mode.toLowerCase(),
    status: session.status.toLowerCase(),
    requestedAt: session.requestedAt.toISOString(),
    endedAt: toIso(session.endedAt)
  };
}

async function addAudit(
  action: string,
  actor: string,
  targetId: string,
  metadata: Prisma.InputJsonValue = {},
  deviceId?: string,
  userId?: string
) {
  await prisma.auditEvent.create({
    data: {
      action,
      actor,
      targetId,
      deviceId,
      userId,
      metadata
    }
  });
}

function normalizeIdentity(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function findDeviceByIdentity(input: {
  customerId: string;
  remoteId: string;
  biosSerial?: string | null;
  systemUuid?: string | null;
  primaryMac?: string | null;
  identityHash?: string | null;
}) {
  const identityCandidates = [
    { field: "identityHash" as const, value: normalizeIdentity(input.identityHash) },
    { field: "systemUuid" as const, value: normalizeIdentity(input.systemUuid) },
    { field: "biosSerial" as const, value: normalizeIdentity(input.biosSerial) },
    { field: "primaryMac" as const, value: normalizeIdentity(input.primaryMac) },
    { field: "remoteId" as const, value: input.remoteId }
  ].filter((candidate): candidate is { field: "identityHash" | "systemUuid" | "biosSerial" | "primaryMac" | "remoteId"; value: string } =>
    Boolean(candidate.value)
  );

  for (const candidate of identityCandidates) {
    const device = await prisma.device.findFirst({
      where: { [candidate.field]: candidate.value, customerId: input.customerId, archivedAt: null }
    });

    if (device) {
      return { id: device.id, matchedBy: candidate.field };
    }
  }

  return null;
}

export const repository = {
  async listAgentKeys() {
    const keys = await prisma.agentEnrollmentKey.findMany({
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      customerId: key.customerId,
      customerName: key.customer.name,
      active: key.active,
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: toIso(key.lastUsedAt)
    }));
  },

  async createAgentKey(input: { customerId: string; name: string; user: AuthUser }) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) return null;

    const plainKey = `rm_${crypto.randomBytes(24).toString("base64url")}`;
    const key = await prisma.agentEnrollmentKey.create({
      data: {
        name: input.name,
        customerId: input.customerId,
        keyHash: crypto.createHash("sha256").update(plainKey).digest("hex")
      }
    });

    await addAudit(
      "agent-key.created",
      input.user.name,
      key.id,
      { customerId: customer.id, keyName: key.name },
      undefined,
      input.user.id
    );

    return {
      id: key.id,
      name: key.name,
      customerId: key.customerId,
      customerName: customer.name,
      active: key.active,
      createdAt: key.createdAt.toISOString(),
      key: plainKey
    };
  },

  async revokeAgentKey(input: { id: string; user: AuthUser }) {
    const current = await prisma.agentEnrollmentKey.findUnique({
      where: { id: input.id },
      include: { customer: { select: { name: true } } }
    });
    if (!current) return null;

    const key = await prisma.agentEnrollmentKey.update({
      where: { id: input.id },
      data: { active: false }
    });

    await addAudit(
      "agent-key.revoked",
      input.user.name,
      key.id,
      { customerId: key.customerId, keyName: key.name },
      undefined,
      input.user.id
    );

    return {
      id: key.id,
      name: key.name,
      customerId: key.customerId,
      customerName: current.customer.name,
      active: key.active,
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: toIso(key.lastUsedAt)
    };
  },

  async listCustomers() {
    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { devices: { where: { archivedAt: null } }, agentEnrollmentKeys: true } } }
    });

    return customers.map(({ _count, ...customer }) => ({
      ...customer,
      deviceCount: _count.devices,
      agentKeyCount: _count.agentEnrollmentKeys
    }));
  },

  async createCustomer(input: {
    name: string;
    document: string;
    contactName: string;
    contactEmail: string;
    user: AuthUser;
  }) {
    const customer = await prisma.customer.create({
      data: {
        name: input.name,
        document: input.document,
        contactName: input.contactName,
        contactEmail: input.contactEmail
      }
    });

    await addAudit(
      "customer.created",
      input.user.name,
      customer.id,
      { customerId: customer.id, customerName: customer.name },
      undefined,
      input.user.id
    );

    return { ...customer, deviceCount: 0, agentKeyCount: 0 };
  },

  async updateCustomer(input: {
    id: string;
    name: string;
    document: string;
    contactName: string;
    contactEmail: string;
    user: AuthUser;
  }) {
    const current = await prisma.customer.findUnique({ where: { id: input.id } });
    if (!current) return null;

    const customer = await prisma.customer.update({
      where: { id: input.id },
      data: {
        name: input.name,
        document: input.document,
        contactName: input.contactName,
        contactEmail: input.contactEmail
      },
      include: { _count: { select: { devices: { where: { archivedAt: null } }, agentEnrollmentKeys: true } } }
    });

    await addAudit(
      "customer.updated",
      input.user.name,
      customer.id,
      { customerId: customer.id, customerName: customer.name },
      undefined,
      input.user.id
    );

    const { _count, ...value } = customer;
    return { ...value, deviceCount: _count.devices, agentKeyCount: _count.agentEnrollmentKeys };
  },

  async listUsers() {
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.toLowerCase(),
      active: user.active,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt.toISOString()
    }));
  },

  async createUser(input: {
    name: string;
    email: string;
    password: string;
    role: "owner" | "admin" | "technician" | "viewer";
    user: AuthUser;
  }) {
    if (input.role === "owner" && input.user.role !== "owner") return { conflict: false as const, forbidden: true as const };
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) return { conflict: true as const };

    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(input.password),
        role: input.role.toUpperCase() as "OWNER" | "ADMIN" | "TECHNICIAN" | "VIEWER"
      }
    });

    await addAudit(
      "user.created",
      input.user.name,
      created.id,
      { email: created.email, role: input.role },
      undefined,
      input.user.id
    );

    return { conflict: false as const, user: {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role.toLowerCase(),
      active: created.active,
      twoFactorEnabled: created.twoFactorEnabled,
      createdAt: created.createdAt.toISOString()
    } };
  },

  async updateUser(input: {
    id: string;
    name: string;
    email: string;
    role: "owner" | "admin" | "technician" | "viewer";
    active: boolean;
    user: AuthUser;
  }) {
    const current = await prisma.user.findUnique({ where: { id: input.id } });
    if (!current) return { kind: "not_found" as const };
    if (current.role === "OWNER" && input.user.role !== "owner") return { kind: "forbidden" as const };
    if (input.id === input.user.id && !input.active) return { kind: "self_deactivate" as const };
    if (input.role === "owner" && input.user.role !== "owner") return { kind: "forbidden" as const };
    if (current.role === "OWNER" && (input.role !== "owner" || !input.active)) {
      const activeOwners = await prisma.user.count({ where: { role: "OWNER", active: true } });
      if (activeOwners <= 1) return { kind: "last_owner" as const };
    }

    const duplicate = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), id: { not: input.id } }
    });
    if (duplicate) return { kind: "conflict" as const };

    const updated = await prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        role: input.role.toUpperCase() as "OWNER" | "ADMIN" | "TECHNICIAN" | "VIEWER",
        active: input.active,
        sessionVersion: { increment: 1 }
      }
    });

    if (!updated.active) {
      await repository.revokeUserRemoteSessions({ userId: updated.id, actor: input.user.name, reason: "user-deactivated" });
    }

    await addAudit(
      "user.updated",
      input.user.name,
      updated.id,
      { email: updated.email, role: updated.role.toLowerCase(), active: updated.active },
      undefined,
      input.user.id
    );

    return { kind: "updated" as const, user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role.toLowerCase(),
      active: updated.active,
      twoFactorEnabled: updated.twoFactorEnabled,
      createdAt: updated.createdAt.toISOString()
    } };
  },

  async resetUserPassword(input: { id: string; password: string; user: AuthUser }) {
    const current = await prisma.user.findUnique({ where: { id: input.id } });
    if (!current) return { kind: "not_found" as const };
    if (current.role === "OWNER" && input.user.role !== "owner") return { kind: "forbidden" as const };
    await prisma.user.update({ where: { id: input.id }, data: { passwordHash: await hashPassword(input.password), sessionVersion: { increment: 1 } } });
    await repository.revokeUserRemoteSessions({ userId: input.id, actor: input.user.name, reason: "password-reset" });
    await addAudit("user.password.reset", input.user.name, input.id, { email: current.email }, undefined, input.user.id);
    return { kind: "reset" as const, ok: true };
  },

  async deleteCustomer(input: { id: string; user: AuthUser }) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.id },
      include: { _count: { select: { devices: { where: { archivedAt: null } }, agentEnrollmentKeys: true } } }
    });
    if (!customer) return null;

    if (customer._count.devices > 0 || customer._count.agentEnrollmentKeys > 0) {
      return {
        conflict: true as const,
        message: "Nao e possivel excluir este cliente enquanto houver dispositivos ou chaves vinculadas."
      };
    }

    await prisma.customer.delete({ where: { id: customer.id } });
    await addAudit(
      "customer.deleted",
      input.user.name,
      customer.id,
      { customerId: customer.id, customerName: customer.name },
      undefined,
      input.user.id
    );

    return { conflict: false as const, customer };
  },

  async listDevices() {
    const devices = await prisma.device.findMany({
      where: { archivedAt: null },
      include: { customer: { select: { name: true } } },
      orderBy: { displayName: "asc" }
    });

    return devices.map(toDeviceView);
  },

  async getDevice(deviceId: string) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId, archivedAt: null },
      include: { customer: { select: { name: true } } }
    });

    return device ? toDeviceView(device) : null;
  },

  async getAgentDevice(input: { deviceId: string; customerId: string }) {
    const device = await prisma.device.findFirst({
      where: { id: input.deviceId, customerId: input.customerId, archivedAt: null },
      include: { customer: { select: { name: true } } }
    });

    return device ? toDeviceView(device) : null;
  },

  async listArchivedDevices() {
    const devices = await prisma.device.findMany({
      where: { archivedAt: { not: null } },
      include: { customer: { select: { name: true } } },
      orderBy: { archivedAt: "desc" }
    });
    return devices.map((device) => ({ ...toDeviceView(device), archivedAt: device.archivedAt?.toISOString() ?? null }));
  },

  async archiveDevice(input: { id: string; user: AuthUser }) {
    const current = await prisma.device.findUnique({ where: { id: input.id } });
    if (!current) return null;
    if (current.archivedAt) return { id: current.id, displayName: current.displayName, archived: true as const };

    const archivedAt = now();
    const device = await prisma.device.update({
      where: { id: current.id },
      data: { archivedAt, lastSeenAt: null }
    });
    await prisma.remoteSession.updateMany({
      where: { deviceId: current.id, status: { not: "ENDED" } },
      data: { status: "ENDED", endedAt: archivedAt, connectionTokenUsedAt: archivedAt }
    });
    await addAudit("device.archived", input.user.name, device.id, { customerId: device.customerId, displayName: device.displayName }, undefined, input.user.id);
    return { id: device.id, displayName: device.displayName, archived: true as const };
  },

  async restoreDevice(input: { id: string; user: AuthUser }) {
    const current = await prisma.device.findUnique({ where: { id: input.id } });
    if (!current) return null;
    const device = await prisma.device.update({
      where: { id: current.id },
      data: { archivedAt: null },
      include: { customer: { select: { name: true } } }
    });
    await addAudit("device.restored", input.user.name, device.id, { customerId: device.customerId, displayName: device.displayName }, device.id, input.user.id);
    return toDeviceView(device);
  },

  async moveDevice(input: { id: string; customerId: string; user: AuthUser }) {
    const [device, customer] = await Promise.all([
      prisma.device.findUnique({ where: { id: input.id } }),
      prisma.customer.findUnique({ where: { id: input.customerId } })
    ]);
    if (!device) return { kind: "device_not_found" as const };
    if (!customer) return { kind: "customer_not_found" as const };
    if (device.customerId === customer.id) {
      const current = await prisma.device.findUnique({
        where: { id: device.id },
        include: { customer: { select: { name: true } } }
      });
      return current ? { kind: "unchanged" as const, device: toDeviceView(current) } : { kind: "device_not_found" as const };
    }

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { customerId: customer.id },
      include: { customer: { select: { name: true } } }
    });

    await addAudit(
      "device.customer.moved",
      input.user.name,
      updated.id,
      { fromCustomerId: device.customerId, toCustomerId: customer.id, toCustomerName: customer.name },
      updated.id,
      input.user.id
    );

    return { kind: "moved" as const, device: toDeviceView(updated) };
  },

  async deleteDevice(input: { id: string; user: AuthUser }) {
    const device = await prisma.device.findUnique({ where: { id: input.id } });
    if (!device) return null;

    await prisma.$transaction(async (transaction) => {
      await transaction.device.delete({ where: { id: device.id } });
      await transaction.auditEvent.create({
        data: {
          action: "device.deleted",
          actor: input.user.name,
          targetId: device.id,
          userId: input.user.id,
          metadata: { customerId: device.customerId, displayName: device.displayName }
        }
      });
    });

    return { id: device.id, displayName: device.displayName };
  },

  async registerDevice(input: {
    customerId: string;
    displayName: string;
    remoteId: string;
    os: string;
    userName: string;
    localIp: string;
    biosSerial?: string | null;
    systemUuid?: string | null;
    primaryMac?: string | null;
    identityHash?: string | null;
    tags?: string[];
  }) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) return null;

    const existingDevice = await findDeviceByIdentity(input);
    const deviceData = {
      customerId: input.customerId,
      displayName: input.displayName,
      remoteId: input.remoteId,
      os: input.os,
      userName: input.userName,
      localIp: input.localIp,
      biosSerial: normalizeIdentity(input.biosSerial),
      systemUuid: normalizeIdentity(input.systemUuid),
      primaryMac: normalizeIdentity(input.primaryMac),
      identityHash: normalizeIdentity(input.identityHash),
      tags: input.tags ?? [],
      lastSeenAt: now()
    };

    const device = existingDevice
      ? await prisma.device.update({
          where: { id: existingDevice.id },
          data: deviceData,
          include: { customer: { select: { name: true } } }
        })
      : await prisma.device.create({
          data: deviceData,
          include: { customer: { select: { name: true } } }
        });

    await addAudit(
      existingDevice ? "device.reidentified" : "device.registered",
      "agent",
      device.id,
      {
        customerId: input.customerId,
        matchedBy: existingDevice?.matchedBy ?? "new"
      },
      device.id
    );
    return toDeviceView(device);
  },

  async heartbeat(input: { deviceId: string; customerId?: string }) {
    const current = await prisma.device.findFirst({
      where: { id: input.deviceId, archivedAt: null, ...(input.customerId ? { customerId: input.customerId } : {}) }
    });
    if (!current) return null;

    const device = await prisma.device.update({
      where: { id: input.deviceId },
      data: { lastSeenAt: now() },
      include: { customer: { select: { name: true } } }
    });

    await addAudit("device.heartbeat", "agent", device.id, {}, device.id);
    return toDeviceView(device);
  },

  async saveInventory(input: {
    deviceId: string;
    customerId?: string;
    hardware: Prisma.InputJsonValue;
    software: Prisma.InputJsonValue;
    actor: string;
  }) {
    const current = await prisma.device.findFirst({
      where: { id: input.deviceId, archivedAt: null, ...(input.customerId ? { customerId: input.customerId } : {}) }
    });
    if (!current) return null;

    const [snapshot] = await prisma.$transaction([
      prisma.inventorySnapshot.create({
        data: {
          deviceId: input.deviceId,
          hardware: input.hardware,
          software: input.software
        }
      }),
      prisma.device.update({
        where: { id: input.deviceId },
        data: { lastSeenAt: now() }
      }),
      prisma.auditEvent.create({
        data: {
          action: "device.inventory.collected",
          actor: input.actor,
          targetId: input.deviceId,
          deviceId: input.deviceId,
          metadata: {}
        }
      })
    ]);

    return {
      ...snapshot,
      collectedAt: snapshot.collectedAt.toISOString()
    };
  },

  async listInventory(deviceId: string) {
    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { deviceId },
      orderBy: { collectedAt: "desc" },
      take: 10
    });

    return snapshots.map((snapshot) => ({
      ...snapshot,
      collectedAt: snapshot.collectedAt.toISOString()
    }));
  },

  async createCommand(input: {
    deviceId: string;
    commandType: CommandType;
    payload?: Prisma.InputJsonValue;
    user: AuthUser;
  }) {
    const device = await prisma.device.findUnique({ where: { id: input.deviceId, archivedAt: null } });
    if (!device) return null;

    const [command] = await prisma.$transaction([
      prisma.commandExecution.create({
        data: {
          deviceId: input.deviceId,
          commandType: input.commandType,
          requestedBy: input.user.name,
          userId: input.user.id,
          payload: input.payload ?? {}
        }
      }),
      prisma.auditEvent.create({
        data: {
          action: "device.command.created",
          actor: input.user.name,
          targetId: input.deviceId,
          deviceId: input.deviceId,
          userId: input.user.id,
          metadata: { commandType: input.commandType }
        }
      })
    ]);

    return toCommandView(command);
  },

  async listCommands(deviceId: string) {
    const device = await prisma.device.findUnique({ where: { id: deviceId, archivedAt: null }, select: { id: true } });
    if (!device) return [];
    const commands = await prisma.commandExecution.findMany({
      where: { deviceId },
      orderBy: { requestedAt: "desc" },
      take: 20
    });

    return commands.map(toCommandView);
  },

  async claimPendingCommands(input: { deviceId: string; customerId: string }) {
    const device = await prisma.device.findFirst({
      where: { id: input.deviceId, customerId: input.customerId, archivedAt: null }
    });
    if (!device) return null;

    const pending = await prisma.commandExecution.findMany({
      where: { deviceId: input.deviceId, status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      take: 5
    });

    const claimed = [];
    for (const command of pending) {
      const updated = await prisma.commandExecution.update({
        where: { id: command.id },
        data: { status: "RUNNING", startedAt: now() }
      });
      claimed.push(toCommandView(updated));
    }

    return claimed;
  },

  async completeCommand(input: {
    commandId: string;
    customerId: string;
    status: "succeeded" | "failed";
    output?: Prisma.InputJsonValue;
    error?: string | null;
  }) {
    const command = await prisma.commandExecution.findFirst({
      where: {
        id: input.commandId,
        device: { customerId: input.customerId, archivedAt: null }
      }
    });
    if (!command) return null;

    const updated = await prisma.commandExecution.update({
      where: { id: input.commandId },
      data: {
        status: input.status === "succeeded" ? "SUCCEEDED" : "FAILED",
        completedAt: now(),
        output: input.output ?? undefined,
        error: input.error ?? null
      }
    });

    await addAudit(
      "device.command.completed",
      "agent",
      updated.deviceId,
      { commandId: updated.id, commandType: updated.commandType, status: input.status },
      updated.deviceId
    );

    return toCommandView(updated);
  },

  async requestRemoteSession(input: { deviceId: string; reason: string; mode: RemoteSessionMode; user: AuthUser }) {
    const device = await prisma.device.findUnique({ where: { id: input.deviceId, archivedAt: null } });
    if (!device) return null;

    const [session] = await prisma.$transaction([
      prisma.remoteSession.create({
        data: {
          deviceId: device.id,
          userId: input.user.id,
          technicianName: input.user.name,
          reason: input.reason,
          mode: input.mode.toUpperCase() as "SUPPORT" | "GAME"
        }
      }),
      prisma.auditEvent.create({
        data: {
          action: "remote-session.requested",
          actor: input.user.name,
          targetId: device.id,
          deviceId: device.id,
          userId: input.user.id,
          metadata: { reason: input.reason, mode: input.mode }
        }
      })
    ]);

    return toRemoteSessionView(session);
  },

  async approveRemoteSession(input: { id: string; user: AuthUser }) {
    const current = await prisma.remoteSession.findUnique({
      where: { id: input.id },
      include: { device: true }
    });
    if (!current) return null;
    if (current.status !== "REQUESTED") return { kind: "unchanged" as const, status: current.status.toLowerCase() };
    if (current.mode === "GAME" && (process.env.ENABLE_GAME_MODE !== "true" || !process.env.REALTIME_INTERNAL_SECRET)) {
      await addAudit(
        "remote-session.unavailable",
        input.user.name,
        current.deviceId,
        { sessionId: current.id, mode: "game", reason: "native-game-client-not-ready" },
        current.deviceId,
        input.user.id
      );
      return {
        kind: "unavailable" as const,
        message: "O modo jogo ainda nao esta disponivel neste ambiente. A sessao nao foi aprovada."
      };
    }

    const desktopToken = createDesktopSessionToken({
      sessionId: current.id,
      deviceId: current.deviceId,
      mode: current.mode.toLowerCase() as RemoteSessionMode,
      role: "client",
      remoteId: current.device.remoteId
    });

    const claimed = await prisma.remoteSession.updateMany({
      where: { id: current.id, status: "REQUESTED" },
      data: {
        status: "APPROVED",
        connectionTokenHash: desktopToken.hash,
        connectionTokenExpiresAt: desktopToken.expiresAt,
        connectionTokenUsedAt: null
      }
    });
    if (claimed.count !== 1) {
      const latest = await prisma.remoteSession.findUnique({ where: { id: current.id } });
      return latest ? { kind: "unchanged" as const, status: latest.status.toLowerCase() } : null;
    }
    const session = await prisma.remoteSession.findUnique({
      where: { id: current.id },
      include: { device: true }
    });
    if (!session) return null;
    await addAudit("remote-session.approved", input.user.name, session.deviceId, { sessionId: session.id }, session.deviceId, input.user.id);
    const sessionView = toRemoteSessionView(session);
    return {
      kind: "approved" as const,
      session: {
        ...sessionView,
        connection: session.mode === "SUPPORT"
          ? {
              protocol: "rustdesk",
              status: "ready",
              uri: `rustdesk://connection/new/${encodeURIComponent(session.device.remoteId)}`,
              command: `rustdesk.exe --connect "${session.device.remoteId}"`,
              desktopSession: {
                sessionId: session.id,
                deviceId: session.deviceId,
                mode: "support",
                role: "client",
                remoteId: session.device.remoteId,
                accessToken: desktopToken.token,
                expiresAt: desktopToken.expiresAt.toISOString()
              }
            }
          : {
              protocol: "native-game",
            status: "ready",
            desktopSession: {
              sessionId: session.id,
              deviceId: session.deviceId,
              mode: "game",
              role: "client",
              remoteId: session.device.remoteId,
              accessToken: desktopToken.token,
              expiresAt: desktopToken.expiresAt.toISOString()
            }
            }
      }
    };
  },

  async consumeDesktopSessionToken(token: string) {
    const payload = verifyDesktopSessionToken(token);
    if (!payload) return { kind: "invalid" as const };

    const current = await prisma.remoteSession.findUnique({
      where: { id: payload.sessionId },
      include: { device: true }
    });
    if (!current || current.connectionTokenHash !== hashToken(token)) return { kind: "invalid" as const };
    if (current.status !== "APPROVED" || current.connectionTokenUsedAt || !current.connectionTokenExpiresAt || current.connectionTokenExpiresAt <= new Date()) {
      return { kind: "expired" as const };
    }

    const consumedAt = now();
    const claimed = await prisma.remoteSession.updateMany({
      where: {
        id: current.id,
        connectionTokenHash: hashToken(token),
        status: "APPROVED",
        connectionTokenUsedAt: null,
        connectionTokenExpiresAt: { gt: consumedAt }
      },
      data: { connectionTokenUsedAt: consumedAt }
    });
    if (claimed.count !== 1) return { kind: "expired" as const };

    const consumed = await prisma.remoteSession.findUnique({
      where: { id: current.id }
    });
    if (!consumed) return { kind: "invalid" as const };
    await addAudit(
      "remote-session.token.consumed",
      "desktop-control",
      consumed.deviceId,
      { sessionId: consumed.id, mode: consumed.mode.toLowerCase() },
      consumed.deviceId
    );

    return {
      kind: "consumed" as const,
      session: {
        sessionId: consumed.id,
        deviceId: consumed.deviceId,
        mode: consumed.mode.toLowerCase(),
        role: "client" as const,
        remoteId: current.device.remoteId,
        expiresAt: current.connectionTokenExpiresAt.toISOString()
      }
    };
  },

  async endDesktopSessionToken(token: string) {
    const payload = verifyDesktopSessionToken(token);
    if (!payload) return { kind: "invalid" as const };

    const current = await prisma.remoteSession.findUnique({ where: { id: payload.sessionId } });
    if (!current || current.connectionTokenHash !== hashToken(token)) return { kind: "invalid" as const };
    if (current.status === "ENDED") return { kind: "ended" as const, sessionId: current.id };

    const endedAt = now();
    const claimed = await prisma.remoteSession.updateMany({
      where: { id: current.id, connectionTokenHash: hashToken(token), status: { not: "ENDED" } },
      data: { status: "ENDED", endedAt, connectionTokenUsedAt: endedAt }
    });
    if (claimed.count !== 1) return { kind: "ended" as const, sessionId: current.id };

    await addAudit(
      "remote-session.ended",
      "native-operator",
      current.deviceId,
      { sessionId: current.id, source: "native-client" },
      current.deviceId,
      current.userId ?? undefined
    );
    return { kind: "ended" as const, sessionId: current.id };
  },

  async authorizeDesktopSessionChannel(token: string) {
    const payload = verifyDesktopSessionToken(token);
    if (!payload) return { kind: "invalid" as const };

    const current = await prisma.remoteSession.findUnique({
      where: { id: payload.sessionId },
      include: { device: true }
    });
    if (!current) return { kind: "invalid" as const };
    if (payload.role === "client" && current.connectionTokenHash !== hashToken(token)) return { kind: "invalid" as const };
    if (payload.role === "host" && payload.deviceId !== current.deviceId) return { kind: "invalid" as const };
    if (
      current.status !== "APPROVED" ||
      !current.connectionTokenUsedAt ||
      current.mode.toLowerCase() !== payload.mode ||
      !current.connectionTokenExpiresAt ||
      current.connectionTokenExpiresAt <= new Date()
    ) {
      return { kind: "expired" as const };
    }

    return {
      kind: "authorized" as const,
      session: {
        sessionId: current.id,
        deviceId: current.deviceId,
        mode: current.mode.toLowerCase(),
        role: payload.role,
        remoteId: current.device.remoteId,
        expiresAt: current.connectionTokenExpiresAt.toISOString()
      }
    };
  },

  async listAgentRemoteSessions(input: { deviceId: string; customerId: string }) {
    const device = await prisma.device.findFirst({ where: { id: input.deviceId, customerId: input.customerId, archivedAt: null } });
    if (!device) return null;

    const sessions = await prisma.remoteSession.findMany({
      where: {
        deviceId: device.id,
        status: "APPROVED",
        connectionTokenUsedAt: { not: null },
        connectionTokenExpiresAt: { gt: new Date() }
      },
      orderBy: { requestedAt: "asc" }
    });

    return sessions.map((session) => {
      const hostToken = createDesktopSessionToken({
        sessionId: session.id,
        deviceId: session.deviceId,
        mode: session.mode.toLowerCase() as RemoteSessionMode,
        role: "host",
        remoteId: device.remoteId
      });
      return {
        sessionId: session.id,
        deviceId: session.deviceId,
        mode: session.mode.toLowerCase(),
        role: "host" as const,
        accessToken: hostToken.token,
        expiresAt: hostToken.expiresAt.toISOString()
      };
    });
  },

  async denyRemoteSession(input: { id: string; user: AuthUser }) {
    const current = await prisma.remoteSession.findUnique({ where: { id: input.id } });
    if (!current) return null;
    if (current.status !== "REQUESTED") return { kind: "unchanged" as const, status: current.status.toLowerCase() };

    const claimed = await prisma.remoteSession.updateMany({
      where: { id: current.id, status: "REQUESTED" },
      data: { status: "DENIED" }
    });
    if (claimed.count !== 1) {
      const latest = await prisma.remoteSession.findUnique({ where: { id: current.id } });
      return latest ? { kind: "unchanged" as const, status: latest.status.toLowerCase() } : null;
    }
    const session = await prisma.remoteSession.findUnique({ where: { id: current.id } });
    if (!session) return null;
    await addAudit("remote-session.denied", input.user.name, session.deviceId, { sessionId: session.id }, session.deviceId, input.user.id);
    return { kind: "denied" as const, status: session.status.toLowerCase() };
  },

  async listSessions() {
    const sessions = await prisma.remoteSession.findMany({
      orderBy: { requestedAt: "desc" },
      take: 50,
      include: { device: { select: { displayName: true, remoteId: true, customer: { select: { name: true } } } } }
    });
    return sessions.map((session) => ({
      ...toRemoteSessionView(session),
      deviceName: session.device.displayName,
      customerName: session.device.customer.name,
      remoteId: session.device.remoteId
    }));
  },

  async endRemoteSession(input: { id: string; user: AuthUser }) {
    const current = await prisma.remoteSession.findFirst({
      where: {
        id: input.id,
        ...(input.user.role === "technician" ? { userId: input.user.id } : {})
      }
    });
    if (!current) return null;
    if (current.status === "ENDED") {
      return {
        ...current,
        requestedAt: current.requestedAt.toISOString(),
        endedAt: toIso(current.endedAt),
        mode: current.mode.toLowerCase(),
        status: current.status.toLowerCase()
      };
    }

    const endedAt = now();
    const claimed = await prisma.remoteSession.updateMany({
      where: { id: current.id, status: { not: "ENDED" }, ...(input.user.role === "technician" ? { userId: input.user.id } : {}) },
      data: { status: "ENDED", endedAt, connectionTokenUsedAt: endedAt }
    });
    if (claimed.count !== 1) {
      const latest = await prisma.remoteSession.findFirst({ where: { id: current.id, ...(input.user.role === "technician" ? { userId: input.user.id } : {}) } });
      if (!latest) return null;
      return toRemoteSessionView(latest);
    }
    const session = await prisma.remoteSession.findUnique({ where: { id: current.id } });
    if (!session) return null;
    await addAudit(
      "remote-session.ended",
      input.user.name,
      session.deviceId,
      { sessionId: session.id },
      session.deviceId,
      input.user.id
    );

    return toRemoteSessionView(session);
  },

  async revokeUserRemoteSessions(input: { userId: string; actor: string; reason: string }) {
    const endedAt = now();
    const activeSessions = await prisma.remoteSession.findMany({
      where: { userId: input.userId, status: { not: "ENDED" } },
      select: { id: true, deviceId: true }
    });
    if (activeSessions.length === 0) return 0;

    await prisma.remoteSession.updateMany({
      where: { userId: input.userId, status: { not: "ENDED" } },
      data: { status: "ENDED", endedAt, connectionTokenUsedAt: endedAt }
    });
    for (const session of activeSessions) {
      await addAudit(
        "remote-session.revoked",
        input.actor,
        session.deviceId,
        { sessionId: session.id, reason: input.reason },
        session.deviceId,
        input.userId
      );
    }
    return activeSessions.length;
  },

  async listAuditEvents() {
    const events = await prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString()
    }));
  },

  async summary() {
    const [customers, devices, sessions] = await Promise.all([
      prisma.customer.count(),
      prisma.device.findMany({ where: { archivedAt: null }, select: { lastSeenAt: true } }),
      prisma.remoteSession.count()
    ]);

    const onlineDevices = devices.filter((device) => getStatus(device.lastSeenAt).status === "online").length;

    return {
      customers,
      devices: devices.length,
      onlineDevices,
      offlineDevices: devices.length - onlineDevices,
      sessions
    };
  }
};
