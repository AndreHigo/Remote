import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db.js";
import { isAgentRemoteIdAllowed } from "./agent-binding.js";

export interface AuthenticatedAgentRequest extends Request {
  agent: {
    id: string;
    name: string;
    customerId: string;
    boundRemoteId: string | null;
  };
}

export function hashAgentKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function authenticateAgent(request: Request, response: Response, next: NextFunction) {
  const key = request.header("x-agent-key");
  if (!key) {
    response.status(401).json({ message: "Chave de agente ausente" });
    return;
  }

  const enrollmentKey = await prisma.agentEnrollmentKey.findUnique({
    where: { keyHash: hashAgentKey(key) },
    select: { id: true, name: true, customerId: true, boundRemoteId: true, active: true }
  });

  if (!enrollmentKey?.active) {
    response.status(401).json({ message: "Chave de agente invalida" });
    return;
  }

  await prisma.agentEnrollmentKey.update({
    where: { id: enrollmentKey.id },
    data: { lastUsedAt: new Date() }
  });

  (request as AuthenticatedAgentRequest).agent = {
    id: enrollmentKey.id,
    name: enrollmentKey.name,
    customerId: enrollmentKey.customerId,
    boundRemoteId: enrollmentKey.boundRemoteId
  };

  next();
}

export async function authorizeAgentDevice(request: Request, response: Response, next: NextFunction) {
  const agent = (request as AuthenticatedAgentRequest).agent;
  if (!agent?.boundRemoteId) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  const deviceId = typeof request.params.id === "string" ? request.params.id : "";
  const device = await prisma.device.findFirst({
    where: { id: deviceId, customerId: agent.customerId, archivedAt: null },
    select: { remoteId: true }
  });
  if (!device || !isAgentRemoteIdAllowed(agent.boundRemoteId, device.remoteId)) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  next();
}
