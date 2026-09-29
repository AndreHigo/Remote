import crypto from "node:crypto";
import type { AuthUser, CommandType, DeviceView } from "./domain.js";
import type { Prisma } from "./generated/prisma/client.js";
import { prisma } from "./db.js";

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
      where: { [candidate.field]: candidate.value, customerId: input.customerId }
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
      include: { _count: { select: { devices: true, agentEnrollmentKeys: true } } }
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

  async deleteCustomer(input: { id: string; user: AuthUser }) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.id },
      include: { _count: { select: { devices: true, agentEnrollmentKeys: true } } }
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
      include: { customer: { select: { name: true } } },
      orderBy: { displayName: "asc" }
    });

    return devices.map(toDeviceView);
  },

  async getDevice(deviceId: string) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: { customer: { select: { name: true } } }
    });

    return device ? toDeviceView(device) : null;
  },

  async getAgentDevice(input: { deviceId: string; customerId: string }) {
    const device = await prisma.device.findFirst({
      where: { id: input.deviceId, customerId: input.customerId },
      include: { customer: { select: { name: true } } }
    });

    return device ? toDeviceView(device) : null;
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
      where: { id: input.deviceId, ...(input.customerId ? { customerId: input.customerId } : {}) }
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
      where: { id: input.deviceId, ...(input.customerId ? { customerId: input.customerId } : {}) }
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
    const device = await prisma.device.findUnique({ where: { id: input.deviceId } });
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
    const commands = await prisma.commandExecution.findMany({
      where: { deviceId },
      orderBy: { requestedAt: "desc" },
      take: 20
    });

    return commands.map(toCommandView);
  },

  async claimPendingCommands(input: { deviceId: string; customerId: string }) {
    const device = await prisma.device.findFirst({
      where: { id: input.deviceId, customerId: input.customerId }
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
        device: { customerId: input.customerId }
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

  async requestRemoteSession(input: { deviceId: string; reason: string; user: AuthUser }) {
    const device = await prisma.device.findUnique({ where: { id: input.deviceId } });
    if (!device) return null;

    const [session] = await prisma.$transaction([
      prisma.remoteSession.create({
        data: {
          deviceId: device.id,
          userId: input.user.id,
          technicianName: input.user.name,
          reason: input.reason
        }
      }),
      prisma.auditEvent.create({
        data: {
          action: "remote-session.requested",
          actor: input.user.name,
          targetId: device.id,
          deviceId: device.id,
          userId: input.user.id,
          metadata: { reason: input.reason }
        }
      })
    ]);

    return {
      ...session,
      requestedAt: session.requestedAt.toISOString(),
      endedAt: toIso(session.endedAt),
      status: session.status.toLowerCase(),
      connection: {
        protocol: "rustdesk",
        uri: `rustdesk://connection/new/${encodeURIComponent(device.remoteId)}`,
        command: `rustdesk.exe --connect "${device.remoteId}"`
      }
    };
  },

  async listSessions() {
    const sessions = await prisma.remoteSession.findMany({ orderBy: { requestedAt: "desc" } });
    return sessions.map((session) => ({
      ...session,
      requestedAt: session.requestedAt.toISOString(),
      endedAt: toIso(session.endedAt),
      status: session.status.toLowerCase()
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
        status: current.status.toLowerCase()
      };
    }

    const session = await prisma.remoteSession.update({
      where: { id: input.id },
      data: { status: "ENDED", endedAt: now() }
    });
    await addAudit(
      "remote-session.ended",
      input.user.name,
      session.deviceId,
      { sessionId: session.id },
      session.deviceId,
      input.user.id
    );

    return {
      ...session,
      requestedAt: session.requestedAt.toISOString(),
      endedAt: toIso(session.endedAt),
      status: session.status.toLowerCase()
    };
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
      prisma.device.findMany({ select: { lastSeenAt: true } }),
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
