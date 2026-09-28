import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser, UserRole } from "./domain.js";
import { prisma } from "./db.js";
import { verifyPassword } from "./password.js";
import {
  createOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotp
} from "./totp.js";

const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const JWT_SECRET = process.env.JWT_SECRET ?? "remoto-local-dev-secret-change-me";
const SESSION_COOKIE = "remoto_session";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

interface LoginAttempt {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttempt>();
const loginAttemptCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of loginAttempts) {
    if (attempt.firstAt + LOGIN_WINDOW_MS < now && attempt.blockedUntil < now) loginAttempts.delete(key);
  }
}, LOGIN_WINDOW_MS);
loginAttemptCleanup.unref();

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${TOKEN_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
}

export function clearSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

interface TokenPayload extends AuthUser {
  exp: number;
}

export async function login(email: string, password: string, totpCode?: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) return null;

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) return null;

  const authUser = toAuthUser(user);
  if (user.twoFactorEnabled) {
    if (!totpCode || !user.twoFactorSecret) return { requiresTwoFactor: true as const, user: authUser };
    try {
      if (!verifyTotp(decryptTotpSecret(user.twoFactorSecret), totpCode)) return null;
    } catch {
      return null;
    }
  }

  return {
    user: authUser,
    token: signToken({
      ...authUser,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    })
  };
}

export function isLoginRateLimited(key: string) {
  const attempt = loginAttempts.get(key);
  return Boolean(attempt && attempt.blockedUntil > Date.now());
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  const attempt = !current || current.firstAt + LOGIN_WINDOW_MS <= now
    ? { count: 1, firstAt: now, blockedUntil: 0 }
    : { ...current, count: current.count + 1 };

  if (attempt.count >= LOGIN_MAX_FAILURES) attempt.blockedUntil = now + LOGIN_WINDOW_MS;
  loginAttempts.set(key, attempt);
  return attempt;
}

export function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}

export async function getTwoFactorStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
  return user ? { enabled: user.twoFactorEnabled } : null;
}

export async function prepareTwoFactor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } });
  if (!user || user.twoFactorEnabled) return null;

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: encryptTotpSecret(secret), twoFactorEnabled: false }
  });

  return { secret, otpauthUri: createOtpAuthUri(user.email, secret) };
}

export async function enableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true } });
  if (!user?.twoFactorSecret) return false;
  try {
    if (!verifyTotp(decryptTotpSecret(user.twoFactorSecret), code)) return false;
  } catch {
    return false;
  }

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  return true;
}

export async function disableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true }
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) return false;
  try {
    if (!verifyTotp(decryptTotpSecret(user.twoFactorSecret), code)) return false;
  } catch {
    return false;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null }
  });
  return true;
}

export async function authenticate(request: Request, response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : readCookie(request.header("cookie"), SESSION_COOKIE);

  if (!token) {
    response.status(401).json({ message: "Token ausente" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    response.status(401).json({ message: "Token invalido ou expirado" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.active) {
    response.status(401).json({ message: "Usuario inativo ou inexistente" });
    return;
  }

  (request as AuthenticatedRequest).user = toAuthUser(user);
  next();
}

export function requireRole(roles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const user = (request as AuthenticatedRequest).user;
    if (!roles.includes(user.role)) {
      response.status(403).json({ message: "Permissao insuficiente" });
      return;
    }

    next();
  };
}

function toAuthUser(user: { id: string; name: string; email: string; role: string }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.toLowerCase() as UserRole
  };
}

function signToken(payload: TokenPayload) {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function readCookie(header: string | undefined, name: string) {
  const value = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(name.length + 1));
  } catch {
    return null;
  }
}
