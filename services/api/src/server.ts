import cors from "cors";
import express from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { authenticateAgent, authorizeAgentDevice, type AuthenticatedAgentRequest } from "./agent-auth.js";
import { isAgentRemoteIdAllowed, isAgentRemoteIdClaimAllowed } from "./agent-binding.js";
import {
  authenticate,
  clearLoginFailures,
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  isLoginRateLimited,
  login,
  isCompletedLogin,
  prepareTwoFactor,
  recordLoginFailure,
  requireRole,
  clearSessionCookie,
  setSessionCookie,
  type AuthenticatedRequest
} from "./auth.js";
import { prisma } from "./db.js";
import { getAgentInstallerPath } from "./installer-download.js";
import { repository } from "./repository.js";
import { createRateLimiter, getRateLimitStoreDiagnostics, getRateLimitStoreStatus } from "./rate-limit.js";

const app = express();
const port = Number(process.env.PORT ?? 4100);
const nodeEnv = process.env.NODE_ENV ?? "development";
const realtimeInternalSecret = process.env.REALTIME_INTERNAL_SECRET;
const realtimeControlUrl = process.env.REALTIME_CONTROL_URL ?? "http://localhost:4200";
const gameModeEnabled = process.env.ENABLE_GAME_MODE === "true" && Boolean(realtimeInternalSecret);
const agentInstallerFileName = "RemotoAgent-Setup.exe";

if (nodeEnv === "production" && (!process.env.JWT_SECRET || !process.env.DESKTOP_SESSION_SECRET || !process.env.TOTP_ENCRYPTION_KEY || !process.env.REDIS_URL)) {
  throw new Error("JWT_SECRET, DESKTOP_SESSION_SECRET, TOTP_ENCRYPTION_KEY e REDIS_URL sao obrigatorios em producao");
}

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true");

function requestClientAddress(request: express.Request) {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

function agentRateLimitKey(request: express.Request) {
  // A chave de autenticacao e bearer e nao pode escolher a identidade do bucket.
  return `ip:${requestClientAddress(request)}`;
}

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
  email: z.string().email().max(160),
  password: z.string().min(1).max(200),
  totpCode: z.string().regex(/^\d{6}$/).optional()
});

const twoFactorCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/)
});

const remoteSessionSchema = z.object({
  deviceId: z.string().min(1),
  reason: z.string().trim().min(4).max(500),
  mode: z.enum(["support", "game"]).default("support"),
  monitorIndex: z.number().int().min(0).max(16).optional()
});

const desktopSessionConsumeSchema = z.object({
  accessToken: z.string().min(32).max(2048)
});

const inventorySchema = z.object({
  hardware: z.record(z.string().max(80), z.unknown()).refine((value) => JSON.stringify(value).length <= 250_000, "hardware inventory too large"),
  software: z.record(z.string().max(80), z.unknown()).default({}).refine((value) => JSON.stringify(value).length <= 250_000, "software inventory too large")
});

const commandSchema = z.object({
  commandType: z.enum(["ping", "system-info", "refresh-inventory", "list-processes", "list-services", "collect-diagnostics"]),
  payload: z.record(z.string().max(80), z.unknown()).optional().refine(
    (value) => value === undefined || JSON.stringify(value).length <= 32_000,
    "payload de comando muito grande"
  )
});

const commandResultSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  output: z.record(z.string().max(80), z.unknown()).refine((value) => JSON.stringify(value).length <= 128_000, "command output too large").optional(),
  error: z.string().max(4_000).nullable().optional()
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

const moveDeviceSchema = z.object({
  customerId: z.string().trim().min(1)
});

const deviceTagsSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(40)).max(20)
});

const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200),
  role: z.enum(["owner", "admin", "technician", "viewer"])
});

const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  role: z.enum(["owner", "admin", "technician", "viewer"]),
  active: z.boolean()
});

const passwordResetSchema = z.object({ password: z.string().min(8).max(200) });

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "remoto-api",
    gameMode: gameModeEnabled ? "experimental" : "disabled",
    agentInstaller: getAgentInstallerPath() ? "available" : "not-configured"
  });
});

app.get(
  "/downloads/agent",
  createRateLimiter({
    name: "InstallerDownload",
    windowMs: 15 * 60 * 1000,
    max: 30,
    maxEntries: 20_000,
    key: (request) => `ip:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`
  }),
  (request, response) => {
    const installerPath = getAgentInstallerPath();
    if (!installerPath) {
      response.status(404).json({ message: "Instalador do agente ainda nao foi configurado nesta implantacao" });
      return;
    }

    response.download(installerPath, agentInstallerFileName, { dotfiles: "deny" }, (error) => {
      if (!error || response.headersSent) return;
      console.error("Falha ao enviar instalador do agente", error);
      response.status(404).json({ message: "Instalador do agente indisponivel" });
    });
  }
);

app.get("/ready", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const rateLimitStore = await getRateLimitStoreStatus();
    if (rateLimitStore === "unavailable") {
      response.status(503).json({ ok: false, service: "remoto-api", database: "ready", rateLimit: "unavailable" });
      return;
    }
    response.json({ ok: true, service: "remoto-api", database: "ready", rateLimit: rateLimitStore });
  } catch {
    response.status(503).json({ ok: false, service: "remoto-api", database: "unavailable" });
  }
});

app.get("/admin/rate-limit/diagnostics", requireRole(["owner", "admin"]), async (_request, response) => {
  const diagnostics = await getRateLimitStoreDiagnostics();
  response.status(diagnostics.store === "unavailable" ? 503 : 200).json(diagnostics);
});

app.post(
  "/auth/login",
  createRateLimiter({
    name: "LoginIP",
    windowMs: 15 * 60 * 1000,
    max: 100,
    maxEntries: 20_000,
    key: (request) => `ip:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`
  }),
  createRateLimiter({
    name: "LoginAccount",
    windowMs: 15 * 60 * 1000,
    max: 30,
    maxEntries: 20_000,
    key: (request) => {
      const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "unknown";
      return `email:${email}`;
    }
  }),
  async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const clientIp = request.ip ?? request.socket.remoteAddress ?? "unknown";
  const normalizedEmail = parsed.data.email.toLowerCase();
  const loginKeys = [`pair:${clientIp}:${normalizedEmail}`, `ip:${clientIp}`, `email:${normalizedEmail}`];
  if (isLoginRateLimited(loginKeys)) {
    response.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    return;
  }

  const result = await login(parsed.data.email, parsed.data.password, parsed.data.totpCode);
  if (!result) {
    const attempt = recordLoginFailure(loginKeys);
    if (attempt.blockedUntil > Date.now()) {
      response.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
      return;
    }

    response.status(401).json({ message: "Credenciais ou codigo de autenticacao invalidos" });
    return;
  }

  if (isCompletedLogin(result)) {
    clearLoginFailures(loginKeys);
    setSessionCookie(response, result.token);
  }
  if (nodeEnv === "production" && isCompletedLogin(result)) {
    response.json({ user: result.user });
    return;
  }

    response.json(result);
  }
);

app.post("/auth/logout", authenticate, async (request, response) => {
  const user = (request as AuthenticatedRequest).user;
  await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  const revokedSessions = await repository.revokeUserRemoteSessions({ userId: user.id, actor: user.name, reason: "logout" });
  void Promise.all(revokedSessions.map((sessionId) => closeRealtimeSession(sessionId)));
  clearSessionCookie(response);
  response.json({ ok: true });
});

app.use(
  "/agent",
  createRateLimiter({
    name: "AgentIP",
    windowMs: 60 * 1000,
    max: 600,
    maxEntries: 20_000,
    key: (request) => `ip:${requestClientAddress(request)}`
  }),
  createRateLimiter({
    name: "Agent",
    windowMs: 60 * 1000,
    max: 180,
    maxEntries: 20_000,
    key: agentRateLimitKey
  })
);

const agentDeviceRateLimit = createRateLimiter({
  name: "AgentDevice",
  windowMs: 60 * 1000,
  max: 120,
  maxEntries: 20_000,
  key: (request) => {
    const agent = (request as AuthenticatedAgentRequest).agent;
    const deviceId = typeof request.params.id === "string" ? request.params.id : "unknown";
    return `agent:${agent?.id ?? "unknown"}:device:${deviceId}`;
  }
});

app.post("/agent/devices/register", authenticateAgent, async (request, response) => {
  const parsed = agentRegisterDeviceSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const agent = (request as AuthenticatedAgentRequest).agent;
  const existingRemoteId = await prisma.device.findUnique({
    where: { remoteId: parsed.data.remoteId },
    select: { id: true, remoteId: true, customerId: true, archivedAt: true }
  });
  if (existingRemoteId?.archivedAt) {
    response.status(410).json({ message: "Este computador esta arquivado. Restaure-o no painel antes de usar o agente novamente." });
    return;
  }
  if (existingRemoteId && existingRemoteId.customerId !== agent.customerId) {
    response.status(409).json({
      message: "Este computador ja esta vinculado a outro cliente. Use uma chave do mesmo cliente ou revincule o dispositivo pelo painel."
    });
    return;
  }

  if (!isAgentRemoteIdAllowed(agent.boundRemoteId, parsed.data.remoteId)) {
    response.status(409).json({
      message: "Esta chave ja esta vinculada a outro computador. Gere uma nova chave para cadastrar outra maquina."
    });
    return;
  }
  if (!isAgentRemoteIdClaimAllowed(agent.boundRemoteId, existingRemoteId?.remoteId ?? null, parsed.data.remoteId)) {
    response.status(409).json({
      message: "Este computador ja esta cadastrado. Gere uma chave especifica para reinstalar ou use uma nova maquina."
    });
    return;
  }

  let claimedKey = false;
  if (!agent.boundRemoteId) {
    const claimed = await prisma.agentEnrollmentKey.updateMany({
      where: { id: agent.id, active: true, boundRemoteId: null },
      data: { boundRemoteId: parsed.data.remoteId }
    });
    if (claimed.count === 1) {
      claimedKey = true;
    } else {
      const latestKey = await prisma.agentEnrollmentKey.findUnique({ where: { id: agent.id }, select: { active: true, boundRemoteId: true } });
      if (!latestKey?.active || latestKey.boundRemoteId !== parsed.data.remoteId) {
        response.status(409).json({
          message: "Esta chave foi vinculada a outro computador durante o cadastro. Gere uma nova chave para outra maquina."
        });
        return;
      }
    }
  }

  let device;
  try {
    device = await repository.registerDevice({
      customerId: agent.customerId,
      ...parsed.data,
      tags: [...(parsed.data.tags ?? []), "agent-cli"]
    });
  } catch (error) {
    if (claimedKey) {
      await prisma.agentEnrollmentKey.updateMany({
        where: { id: agent.id, boundRemoteId: parsed.data.remoteId },
        data: { boundRemoteId: null }
      });
    }
    throw error;
  }

  if (device && "kind" in device && device.kind === "identity-conflict") {
    if (claimedKey) {
      await prisma.agentEnrollmentKey.updateMany({
        where: { id: agent.id, boundRemoteId: parsed.data.remoteId },
        data: { boundRemoteId: null }
      });
    }
    response.status(409).json({
      message: "A identidade informada ja pertence a outro computador. Use a chave criada para esse computador ou gere uma nova chave."
    });
    return;
  }

  if (!device) {
    if (claimedKey) {
      await prisma.agentEnrollmentKey.updateMany({
        where: { id: agent.id, boundRemoteId: parsed.data.remoteId },
        data: { boundRemoteId: null }
      });
    }
    response.status(404).json({ message: "Cliente do agente nao encontrado" });
    return;
  }

  response.status(201).json(device);
});

app.post("/agent/devices/:id/heartbeat", authenticateAgent, authorizeAgentDevice, agentDeviceRateLimit, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const agent = (request as AuthenticatedAgentRequest).agent;
  const device = await repository.heartbeat({ deviceId, customerId: agent.customerId });
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  response.json(device);
});

app.get("/agent/devices/:id/status", authenticateAgent, authorizeAgentDevice, agentDeviceRateLimit, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const agent = (request as AuthenticatedAgentRequest).agent;
  const device = await repository.getAgentDevice({ deviceId, customerId: agent.customerId });
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  response.json(device);
});

app.post("/agent/devices/:id/inventory", authenticateAgent, authorizeAgentDevice, agentDeviceRateLimit, async (request, response) => {
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

app.get("/agent/devices/:id/commands", authenticateAgent, authorizeAgentDevice, agentDeviceRateLimit, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const agent = (request as AuthenticatedAgentRequest).agent;
  const commands = await repository.claimPendingCommands({ deviceId, customerId: agent.customerId });

  if (!commands) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  response.json(commands);
});

app.get("/agent/devices/:id/remote-sessions", authenticateAgent, authorizeAgentDevice, agentDeviceRateLimit, async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const agent = (request as AuthenticatedAgentRequest).agent;
  const sessions = await repository.listAgentRemoteSessions({ deviceId, customerId: agent.customerId });
  if (!sessions) {
    response.status(404).json({ message: "Dispositivo nao encontrado para este agente" });
    return;
  }

  response.json(sessions);
});

app.post("/agent/commands/:id/result", authenticateAgent, async (request, response) => {
  const commandId = z.string().parse(request.params.id);
  const parsed = commandResultSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const agent = (request as AuthenticatedAgentRequest).agent;
  if (!agent.boundRemoteId) {
    response.status(404).json({ message: "Comando nao encontrado para este agente" });
    return;
  }
  const command = await repository.completeCommand({
    commandId,
    customerId: agent.customerId,
    boundRemoteId: agent.boundRemoteId,
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

app.post(
  "/desktop-sessions/consume",
  createRateLimiter({ name: "DesktopSession", windowMs: 60 * 1000, max: 30 }),
  async (request, response) => {
    const parsed = desktopSessionConsumeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: "Token de sessao invalido" });
      return;
    }

    const result = await repository.consumeDesktopSessionToken(parsed.data.accessToken);
    if (result.kind === "invalid") {
      response.status(401).json({ message: "Token de sessao invalido" });
      return;
    }
    if (result.kind === "expired") {
      response.status(410).json({ message: "Token de sessao expirado ou ja utilizado" });
      return;
    }

    response.json(result.session);
  }
);

app.post(
  "/desktop-sessions/end",
  createRateLimiter({ name: "DesktopSessionEnd", windowMs: 60 * 1000, max: 60 }),
  async (request, response) => {
    const parsed = desktopSessionConsumeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: "Token de sessao invalido" });
      return;
    }

    const result = await repository.endDesktopSessionToken(parsed.data.accessToken);
    if (result.kind === "invalid") {
      response.status(401).json({ message: "Token de sessao invalido" });
      return;
    }

    void closeRealtimeSession(result.sessionId);
    response.json({ ok: true });
  }
);

app.post(
  "/desktop-sessions/authorize-channel",
  createRateLimiter({
    name: "RealtimeChannel",
    windowMs: 60 * 1000,
    max: 120,
    key: (request) => {
      const accessToken = typeof request.body?.accessToken === "string" ? request.body.accessToken : "";
      return accessToken
        ? `session:${crypto.createHash("sha256").update(accessToken).digest("hex")}`
        : `ip:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`;
    }
  }),
  async (request, response) => {
    if (!realtimeInternalSecret || !secretsMatch(request.header("x-realtime-secret"), realtimeInternalSecret)) {
      response.status(503).json({ message: "Canal realtime nao configurado" });
      return;
    }

    const parsed = desktopSessionConsumeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: "Token de sessao invalido" });
      return;
    }

    const result = await repository.authorizeDesktopSessionChannel(parsed.data.accessToken);
    if (result.kind === "invalid") {
      response.status(401).json({ message: "Token de canal invalido" });
      return;
    }
    if (result.kind === "expired") {
      response.status(410).json({ message: "Sessao expirada ou encerrada" });
      return;
    }

    response.json(result.session);
  }
);

app.use(authenticate);

app.get("/auth/me", (request, response) => {
  response.json((request as AuthenticatedRequest).user);
});

app.get("/auth/2fa/status", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const user = (request as AuthenticatedRequest).user;
  const status = await getTwoFactorStatus(user.id);
  if (!status) {
    response.status(404).json({ message: "Usuario nao encontrado" });
    return;
  }

  response.json(status);
});

app.post("/auth/2fa/setup", requireRole(["owner", "admin", "technician"]), async (request, response) => {
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

app.post("/auth/2fa/enable", requireRole(["owner", "admin", "technician"]), async (request, response) => {
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
  const revokedSessions = await repository.revokeUserRemoteSessions({ userId: user.id, actor: user.name, reason: "2fa-enabled" });
  void Promise.all(revokedSessions.map((sessionId) => closeRealtimeSession(sessionId)));
  response.json({ enabled: true, sessionRevoked: true, remoteSessionsRevoked: revokedSessions.length });
});

app.post("/auth/2fa/disable", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const parsed = twoFactorCodeSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Informe um codigo de 6 digitos", issues: parsed.error.issues });
    return;
  }

  const user = (request as AuthenticatedRequest).user;
  if (user.role === "technician") {
    response.status(403).json({ message: "Tecnicos nao podem desativar o 2FA." });
    return;
  }
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
  const revokedSessions = await repository.revokeUserRemoteSessions({ userId: user.id, actor: user.name, reason: "2fa-disabled" });
  void Promise.all(revokedSessions.map((sessionId) => closeRealtimeSession(sessionId)));
  response.json({ enabled: false, sessionRevoked: true, remoteSessionsRevoked: revokedSessions.length });
});

app.get("/summary", async (request, response) => {
  response.json(await repository.summary((request as AuthenticatedRequest).user));
});

app.get("/customers", requireRole(["owner", "admin"]), async (request, response) => {
  response.json(await repository.listCustomers((request as AuthenticatedRequest).user));
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

app.patch("/customers/:id", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = customerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const customer = await repository.updateCustomer({
    id: z.string().parse(request.params.id),
    ...parsed.data,
    user: (request as AuthenticatedRequest).user
  });
  if (!customer) {
    response.status(404).json({ message: "Cliente nao encontrado" });
    return;
  }
  response.json(customer);
});

app.get("/users", requireRole(["owner", "admin"]), async (request, response) => {
  response.json(await repository.listUsers((request as AuthenticatedRequest).user));
});

app.post("/users", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = userCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const result = await repository.createUser({ ...parsed.data, user: (request as AuthenticatedRequest).user });
  if ("forbidden" in result && result.forbidden) {
    response.status(403).json({ message: "Somente o owner pode criar outro owner" });
    return;
  }
  if (result.conflict) {
    response.status(409).json({ message: "Ja existe um usuario com este email" });
    return;
  }
  response.status(201).json(result.user);
});

app.patch("/users/:id", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = userUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const result = await repository.updateUser({ id: z.string().parse(request.params.id), ...parsed.data, user: (request as AuthenticatedRequest).user });
  if (result.kind === "not_found") return void response.status(404).json({ message: "Usuario nao encontrado" });
  if (result.kind === "forbidden") return void response.status(403).json({ message: "Voce nao pode alterar este usuario" });
  if (result.kind === "self_deactivate") return void response.status(400).json({ message: "Nao e possivel desativar o proprio usuario" });
  if (result.kind === "last_owner") return void response.status(409).json({ message: "O workspace precisa manter pelo menos um owner ativo" });
  if (result.kind === "conflict") return void response.status(409).json({ message: "Ja existe um usuario com este email" });
  void closeRealtimeSessions(result.sessionIds);
  response.json(result.user);
});

app.post("/users/:id/reset-password", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = passwordResetSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "A senha deve ter pelo menos 8 caracteres", issues: parsed.error.issues });
    return;
  }
  const reset = await repository.resetUserPassword({ id: z.string().parse(request.params.id), password: parsed.data.password, user: (request as AuthenticatedRequest).user });
  if (reset.kind === "not_found") return void response.status(404).json({ message: "Usuario nao encontrado" });
  if (reset.kind === "forbidden") return void response.status(403).json({ message: "Somente o owner pode redefinir a senha de outro owner" });
  void closeRealtimeSessions(reset.sessionIds);
  response.json({ ok: true });
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

app.get("/agent-keys", requireRole(["owner", "admin"]), async (request, response) => {
  response.json(await repository.listAgentKeys((request as AuthenticatedRequest).user));
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

  const { sessionIds, ...view } = revoked;
  void Promise.all(sessionIds.map((sessionId) => closeRealtimeSession(sessionId)));
  response.json(view);
});

app.get("/devices", async (request, response) => {
  response.json(await repository.listDevices((request as AuthenticatedRequest).user));
});

app.get("/devices/archived", requireRole(["owner", "admin"]), async (request, response) => {
  response.json(await repository.listArchivedDevices((request as AuthenticatedRequest).user));
});

app.get("/devices/:id", async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const device = await repository.getDevice(deviceId, (request as unknown as AuthenticatedRequest).user);
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }

  response.json(device);
});

app.get("/devices/:id/inventory", async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  response.json(await repository.listInventory(deviceId, (request as unknown as AuthenticatedRequest).user));
});

app.patch("/devices/:id/customer", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = moveDeviceSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Informe um cliente valido", issues: parsed.error.issues });
    return;
  }

  const result = await repository.moveDevice({
    id: z.string().parse(request.params.id),
    customerId: parsed.data.customerId,
    user: (request as AuthenticatedRequest).user
  });
  if (result.kind === "device_not_found") {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }
  if (result.kind === "customer_not_found") {
    response.status(404).json({ message: "Cliente de destino nao encontrado" });
    return;
  }
  if (result.kind === "moved") void closeRealtimeSessions(result.sessionIds);
  response.json(result.device);
});

app.patch("/devices/:id/tags", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = deviceTagsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Informe ate 20 etiquetas validas", issues: parsed.error.issues });
    return;
  }

  const device = await repository.updateDeviceTags({
    id: z.string().parse(request.params.id),
    tags: parsed.data.tags,
    user: (request as AuthenticatedRequest).user
  });
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }
  response.json(device);
});

app.delete("/devices/:id", requireRole(["owner", "admin"]), async (request, response) => {
  const deleted = await repository.deleteDevice({
    id: z.string().parse(request.params.id),
    user: (request as AuthenticatedRequest).user
  });
  if (!deleted) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }
  void closeRealtimeSessions(deleted.sessionIds);
  const { sessionIds: _sessionIds, ...deletedView } = deleted;
  response.json(deletedView);
});

app.post("/devices/:id/archive", requireRole(["owner", "admin"]), async (request, response) => {
  const archived = await repository.archiveDevice({ id: z.string().parse(request.params.id), user: (request as AuthenticatedRequest).user });
  if (!archived) return void response.status(404).json({ message: "Dispositivo nao encontrado" });
  void closeRealtimeSessions(archived.sessionIds);
  const { sessionIds: _sessionIds, ...archivedView } = archived;
  response.json(archivedView);
});

app.post("/devices/:id/restore", requireRole(["owner", "admin"]), async (request, response) => {
  const restored = await repository.restoreDevice({ id: z.string().parse(request.params.id), user: (request as AuthenticatedRequest).user });
  if (!restored) return void response.status(404).json({ message: "Dispositivo arquivado nao encontrado" });
  response.json(restored);
});

app.get("/devices/:id/commands", async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  response.json(await repository.listCommands(deviceId, (request as unknown as AuthenticatedRequest).user));
});

app.post("/devices/register", requireRole(["owner", "admin"]), async (request, response) => {
  const parsed = registerDeviceSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
    return;
  }

  const device = await repository.registerDevice({ ...parsed.data, workspaceId: (request as AuthenticatedRequest).user.workspaceId });
  if (!device) {
    response.status(404).json({ message: "Cliente nao encontrado" });
    return;
  }

  response.status(201).json(device);
});

app.post("/devices/:id/heartbeat", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const deviceId = z.string().parse(request.params.id);
  const device = await repository.heartbeat({ deviceId, workspaceId: (request as AuthenticatedRequest).user.workspaceId });
  if (!device) {
    response.status(404).json({ message: "Dispositivo nao encontrado" });
    return;
  }

  response.json(device);
});

app.post(
  "/devices/:id/commands",
  requireRole(["owner", "admin", "technician"]),
  createRateLimiter({
    name: "CommandCreate",
    windowMs: 60 * 1000,
    max: 30,
    maxEntries: 20_000,
    key: (request) => {
      const user = (request as AuthenticatedRequest).user;
      return `user:${user.id}:device:${request.params.id}`;
    }
  }),
  async (request, response) => {
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
    if (command.kind === "quota") {
      response.status(409).json({ message: "Este dispositivo ja possui comandos pendentes demais." });
      return;
    }

    response.status(201).json(command.command);
  }
);

app.post(
  "/remote-sessions",
  requireRole(["owner", "admin", "technician"]),
  createRateLimiter({
    name: "RemoteSessionCreate",
    windowMs: 60 * 1000,
    max: 20,
    maxEntries: 20_000,
    key: (request) => {
      const user = (request as AuthenticatedRequest).user;
      const deviceId = typeof request.body?.deviceId === "string" ? request.body.deviceId : "unknown";
      return `user:${user.id}:device:${deviceId}`;
    }
  }),
  async (request, response) => {
    const parsed = remoteSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: "Dados invalidos", issues: parsed.error.issues });
      return;
    }

    const session = await repository.requestRemoteSession({
      deviceId: parsed.data.deviceId,
      reason: parsed.data.reason,
      mode: parsed.data.mode,
      monitorIndex: parsed.data.monitorIndex,
      user: (request as AuthenticatedRequest).user
    });
    if (!session) {
      response.status(404).json({ message: "Dispositivo nao encontrado" });
      return;
    }
    if (session.kind === "quota") {
      response.status(409).json({ message: "Este dispositivo ja possui sessoes abertas demais." });
      return;
    }

    const user = (request as AuthenticatedRequest).user;
    if (user.role === "owner" || user.role === "admin") {
      const approved = await repository.approveRemoteSession({ id: session.session.id, user });
      if (!approved) {
        response.status(404).json({ message: "Sessao nao encontrada" });
        return;
      }
      if (approved.kind === "unavailable") {
        response.status(409).json({ message: approved.message });
        return;
      }
      if (approved.kind === "unchanged") {
        response.status(409).json({ message: `Sessao ja esta ${approved.status}` });
        return;
      }
      response.status(201).json(approved.session);
      return;
    }

    response.status(201).json(session.session);
  }
);

app.post("/remote-sessions/:id/end", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  const session = await repository.endRemoteSession({
    id: z.string().parse(request.params.id),
    user: (request as AuthenticatedRequest).user
  });
  if (!session) {
    response.status(404).json({ message: "Sessao nao encontrada" });
    return;
  }

  void closeRealtimeSession(session.id);
  response.json(session);
});

app.post("/remote-sessions/:id/approve", requireRole(["owner", "admin"]), async (request, response) => {
  const result = await repository.approveRemoteSession({ id: z.string().parse(request.params.id), user: (request as AuthenticatedRequest).user });
  if (!result) return void response.status(404).json({ message: "Sessao nao encontrada" });
  if (result.kind === "unchanged") return void response.status(409).json({ message: `Sessao ja esta ${result.status}` });
  if (result.kind === "unavailable") return void response.status(409).json({ message: result.message });
  response.json(result.session);
});

app.post("/remote-sessions/:id/deny", requireRole(["owner", "admin"]), async (request, response) => {
  const result = await repository.denyRemoteSession({ id: z.string().parse(request.params.id), user: (request as AuthenticatedRequest).user });
  if (!result) return void response.status(404).json({ message: "Sessao nao encontrada" });
  if (result.kind === "unchanged") return void response.status(409).json({ message: `Sessao ja esta ${result.status}` });
  response.json(result);
});

app.get("/remote-sessions", requireRole(["owner", "admin", "technician"]), async (request, response) => {
  response.json(await repository.listSessions((request as AuthenticatedRequest).user));
});

app.get("/audit-events", requireRole(["owner", "admin"]), async (request, response) => {
  response.json(await repository.listAuditEvents((request as AuthenticatedRequest).user));
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

function secretsMatch(received: string | undefined, expected: string) {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function closeRealtimeSession(sessionId: string) {
  if (!realtimeInternalSecret) return;
  try {
    await fetch(`${realtimeControlUrl.replace(/\/$/, "")}/internal/sessions/${encodeURIComponent(sessionId)}/close`, {
      method: "POST",
      headers: { "X-Realtime-Secret": realtimeInternalSecret },
      signal: AbortSignal.timeout(1000)
    });
  } catch {
    // The agent polling loop remains the fallback if the relay is temporarily unavailable.
  }
}

async function closeRealtimeSessions(sessionIds: string[]) {
  await Promise.all(sessionIds.map((sessionId) => closeRealtimeSession(sessionId)));
}
