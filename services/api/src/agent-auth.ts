import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db.js";

export interface AuthenticatedAgentRequest extends Request {
  agent: {
    id: string;
    name: string;
    customerId: string;
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
    select: { id: true, name: true, customerId: true, active: true }
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
    customerId: enrollmentKey.customerId
  };

  next();
}
