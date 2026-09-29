import cors from "cors";
import express from "express";
import { z } from "zod";
import { authenticateAgent, type AuthenticatedAgentRequest } from "./agent-auth.js";
import {
  authenticate,
  clearLoginFailures,
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  isLoginRateLimited,
  login,
  prepareTwoFactor,
  recordLoginFailure,
  requireRole,
  clearSessionCookie,
  setSessionCookie,
  type AuthenticatedRequest
} from "./auth.js";
import { prisma } from "./db.js";
import { repository } from "./repository.js";
import { createRateLimiter } from "./rate-limit.js";

const app = express();
const port = Number(process.env.PORT ?? 4100);
const nodeEnv = process.env.NODE_ENV ?? "development";

if (nodeEnv === "production" && (!process.env.JWT_SECRET || !process.env.TOTP_ENCRYPTION_KEY)) {
  throw new Error("JWT_SECRET e TOTP_ENCRYPTION_KEY sao obrigatorios em producao");
}

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true");
const configuredWebOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedWebOrigins = new Set([
  ...configuredWebOrigins,
    ...(nodeEnv === "production" ? [] : ["http://127.0.0.1:5173"])
]);

app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedWebOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem nao permitida"));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

const registerDeviceSchema = z.object({
  customerId: z.string().min(1),
  displayName: z.string().min(2),
  remoteId: z.string().min(3),
  os: z.string().min(2),
  userName: z.string().min(1),
  localIp: z.string().min(3),
  biosSerial: z.string().nullable().optional(),
  systemUuid: z.string().nullable().optional(),
  primaryMac: z.string().nullable().optional(),
  identityHash: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
});

const agentRegisterDeviceSchema = registerDeviceSchema.omit({ customerId: true });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().regex(/^\d{6}$/).optional()
});

const twoFactorCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/)
});

const remoteSessionSchema = z.object({
  deviceId: z.string().min(1),
  reason: z.string().min(4)
});

const inventorySchema = z.object({
  hardware: z.record(z.string(), z.unknown()),
  software: z.record(z.string(), z.unknown()).default({})
});

const commandSchema = z.object({
  commandType: z.enum(["ping", "system-info", "refresh-inventory"]),
  payload: z.record(z.string(), z.unknown()).optional()
});

const commandResultSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().nullable().optional()
});

const agentKeySchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(3).max(80)
});

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  document: z.string().trim().min(3).max(40),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160)
});

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "remoto-api" });
});

app.get("/ready", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ ok: true, service: "remoto-api", database: "ready" });
  } catch {
    response.status(503).json({ ok: false, service: "remoto-api", database: "unavailable" });
  }
});

app.post("/auth/login", async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const loginKey = `${request.ip ?? request.socket.remoteAddress ?? "unknown"}:${parsed.data.email.toLowerCase()}`;
  if (isLoginRateLimited(loginKey)) {
    response.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    return;
  }

  const result = await login(parsed.data.email, parsed.data.password, parsed.data.totpCode);
  if (!result) {
    const attempt = recordLoginFailure(loginKey);
    if (attempt.blockedUntil > Date.now()) {
      response.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
      return;
    }

    response.status(401).json({ message: "Credenciais ou codigo de autenticacao invalidos" });
    return;
  }

  clearLoginFailures(loginKey);
  if ("token" in result && result.token) setSessionCookie(response, result.token);
  if (nodeEnv === "production" && "token" in result) {
    response.json({ user: result.user });
    return;
  }

  response.json(result);
});

app.post("/auth/logout", (_request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});

app.use(
  "/agent",
  createRateLimiter({
    name: "Agent",
    windowMs: 60 * 1000,
    max: 180
  })
);

app.post("/agent/devices/register", authenticateAgent, async (request, response) => {
  const parsed = agentRegisterDeviceSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const agent = (request as AuthenticatedAgentRequest).agent;
  const existingRemoteId = await prisma.device.findUnique({
    where: { remoteId: parsed.data.remoteId },
    select: { customerId: true }
  });
  if (existingRemoteId && existingRemoteId.customerId !== agent.customerId) {
    response.status(409).json({
      message: "Este computador ja esta vinculado a outro cliente. Use uma chave do mesmo cliente ou revincule o dispositivo pelo painel."
    });
    return;
  }

  const device = await repository.registerDevice({
    customerId: agent.customerId,
    ...parsed.data,
    tags: [...(parsed.data.tags ?? []), "agent-cli"]
  });

  if (!device) {
    response.status(404).json({ message: "Cliente do agente nao encontrado" });
    return;
  }

  response.status(201).json(device);
});

app.post("/agent/devices/:id/heartbeat", authenticateAgent, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const agent = (request as AuthenticatedAgentRequest).agent;
  const device = await repository.heartbeat({ deviceId, customerId: agent.customerId });
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  response.json(device);
});

app.get("/agent/devices/:id/status", authenticateAgent, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const agent = (request as AuthenticatedAgentRequest).agent;
  const device = await repository.getAgentDevice({ deviceId, customerId: agent.customerId });
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  response.json(device);
});

app.post("/agent/devices/:id/inventory", authenticateAgent, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const parsed = inventorySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const agent = (request as AuthenticatedAgentRequest).agent;
  const snapshot = await repository.saveInventory({
    deviceId,
    customerId: agent.customerId,
    hardware: JSON.parse(JSON.stringify(parsed.data.hardware)),
    software: JSON.parse(JSON.stringify(parsed.data.software)),
    actor: agent.name
  });

  if (!snapshot) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }

  response.status(201).json(snapshot);
});

app.get("/agent/devices/:id/commands", authenticateAgent, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const agent = (request as AuthenticatedAgentRequest).agent;
  const commands = await repository.claimPendingCommands({ deviceId, customerId: agent.customerId });

  if (!commands) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  response.json(commands);
});

app.post("/agent/commands/:id/result", authenticateAgent, async (request, response) => {
  const commandId = z.string().parse(request.params.id);
  const parsed = commandResultSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const agent = (request as AuthenticatedAgentRequest).agent;
  const command = await repository.completeCommand({
    commandId,
    customerId: agent.customerId,
    status: parsed.data.status,
    output: parsed.data.output ? JSON.parse(JSON.stringify(parsed.data.output)) : undefined,
    error: parsed.data.error
  });

  if (!command) {
    response.status(404).json({ message: "Comando nao encontrado para este agente" });
    return;
  }

  response.json(command);
});

app.use(authenticate);

app.get("/auth/me", (request, response) => {
  response.json((request as AuthenticatedRequest).user);
});

app.get("/auth/2fa/status", requireRole(["owner", "admin"]), async (request, response) => {
  const user = (request as AuthenticatedRequest).user;
  const status = await getTwoFactorStatus(user.id);
  if (!status) {
    response.status(404).json({ message: "Usuario nao encontrado" });
    return;
  }

  response.json(status);
});

app.post("/auth/2fa/setup", requireRole(["owner", "admin"]), async (request, response) => {
  const user = (request as AuthenticatedRequest).user;
  const setup = await prepareTwoFactor(user.id);
  if (!setup) {
    response.status(409).json({ message: "Desative o 2FA atual antes de gerar outro segredo" });
    return;
  }

  await prisma.auditEvent.create({
    data: {
      action: "auth.2fa.setup",
      actor: user.name,
      targetId: user.id,
      userId: user.id,
      metadata: { email: user.email }
    }
  });
  response.json(setup);
});

app.post("/auth/2fa/enable", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = twoFactorCodeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Informe um codigo de 6 digitos", issues: parsed.error.issues });
    return;
  }

  const user = (request as AuthenticatedRequest).user;
  if (!(await enableTwoFactor(user.id, parsed.data.code))) {
    response.status(400).json({ message: "Codigo TOTP invalido ou configuracao pendente" });
    return;
  }

  await prisma.auditEvent.create({
    data: {
      action: "auth.2fa.enabled",
      actor: user.name,
      targetId: user.id,
      userId: user.id,
      metadata: { email: user.email }
    }
  });
  response.json({ enabled: true });
});

app.post("/auth/2fa/disable", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = twoFactorCodeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Informe um codigo de 6 digitos", issues: parsed.error.issues });
    return;
  }

  const user = (request as AuthenticatedRequest).user;
  if (!(await disableTwoFactor(user.id, parsed.data.code))) {
    response.status(400).json({ message: "Codigo TOTP invalido" });
    return;
  }

  await prisma.auditEvent.create({
    data: {
      action: "auth.2fa.disabled",
      actor: user.name,
      targetId: user.id,
      userId: user.id,
      metadata: { email: user.email }
    }
  });
  response.json({ enabled: false });
});

app.get("/summary", async (_request, response) => {
  response.json(await repository.summary());
});

app.get("/customers", requireRole(["owner", "admin"]), async (_request, response) => {
  response.json(await repository.listCustomers());
});

app.post("/customers", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = customerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const customer = await repository.createCustomer({
    ...parsed.data,
    user: (request as AuthenticatedRequest).user
  });
  response.status(201).json(customer);
});

app.delete("/customers/:id", requireRole(["owner", "admin"]), async (request, response) => {
  const customerId = z.string().parse(request.params.id);
  const result = await repository.deleteCustomer({
    id: customerId,
    user: (request as AuthenticatedRequest).user
  });

  if (!result) {
    response.status(404).json({ message: "Cliente nao encontrado" });
    return;
  }
  if (result.conflict) {
    response.status(409).json({ message: result.message });
    return;
  }

  response.json(result.customer);
});

app.get("/agent-keys", requireRole(["owner", "admin"]), async (_request, response) => {
  response.json(await repository.listAgentKeys());
});

app.post("/agent-keys", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = agentKeySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const created = await repository.createAgentKey({
    ...parsed.data,
    user: (request as AuthenticatedRequest).user
  });
  if (!created) {
    response.status(404).json({ message: "Cliente nao encontrado" });
    return;
  }

  response.status(201).json(created);
});

app.post("/agent-keys/:id/revoke", requireRole(["owner", "admin"]), async (request, response) => {
  const keyId = z.string().parse(request.params.id);
  const revoked = await repository.revokeAgentKey({
    id: keyId,
    user: (request as AuthenticatedRequest).user
  });
  if (!revoked) {
    response.status(404).json({ message: "Chave nao encontrada" });
    return;
  }

  response.json(revoked);
});

app.get("/devices", async (_request, response) => {
  response.json(await repository.listDevices());
});

app.get("/devices/:id", async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const device = await repository.getDevice(deviceId);
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }

  response.json(device);
});

app.get("/devices/:id/inventory", async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  response.json(await repository.listInventory(deviceId));
});

app.get("/devices/:id/commands", async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  response.json(await repository.listCommands(deviceId));
});

app.post("/devices/register", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = registerDeviceSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const device = await repository.registerDevice(parsed.data);
  if (!device) {
    response.status(404).json({ message: "Cliente nao encontrado" });
    return;
  }

  response.status(201).json(device);
});

app.post("/devices/:id/heartbeat", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const device = await repository.heartbeat({ deviceId });
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }

  response.json(device);
});

app.post("/devices/:id/commands", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const parsed = commandSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const command = await repository.createCommand({
    deviceId,
    commandType: parsed.data.commandType,
    payload: parsed.data.payload ? JSON.parse(JSON.stringify(parsed.data.payload)) : undefined,
    user: (request as AuthenticatedRequest).user
  });

  if (!command) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }

  response.status(201).json(command);
});

app.post("/remote-sessions", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const parsed = remoteSessionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const session = await repository.requestRemoteSession({
    deviceId: parsed.data.deviceId,
    reason: parsed.data.reason,
    user: (request as AuthenticatedRequest).user
  });
  if (!session) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }

  response.status(201).json(session);
});

app.post("/remote-sessions/:id/end", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const session = await repository.endRemoteSession({
    id: z.string().parse(request.params.id),
    user: (request as AuthenticatedRequest).user
  });
  if (!session) {
    response.status(404).json({ message: "Sessao nao encontrada" });
    return;
  }

  response.json(session);
});

app.get("/remote-sessions", async (_request, response) => {
  response.json(await repository.listSessions());
});

app.get("/audit-events", async (_request, response) => {
  response.json(await repository.listAuditEvents());
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ message: "Erro interno da API" });
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Remoto API running on http://localhost:${port}`);
});
