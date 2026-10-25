import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type DesktopMode = "support" | "game";
export type DesktopRole = "host" | "client";

export interface DesktopSessionDescriptor {
  sessionId: string;
  deviceId: string;
  mode: DesktopMode;
  role: DesktopRole;
  remoteId?: string;
  accessToken?: string;
  expiresAt?: string;
}

export interface EngineReadiness {
  ready: boolean;
  code: "ready" | "missing-engine" | "unsupported-platform" | "not-implemented";
  message: string;
}

export interface EngineLaunchResult {
  started: boolean;
  message: string;
}

export interface DesktopEngine {
  readonly mode: DesktopMode;
  check(): Promise<EngineReadiness>;
  start(session: DesktopSessionDescriptor): Promise<EngineLaunchResult>;
  stop(session: DesktopSessionDescriptor): Promise<EngineLaunchResult>;
}

export function createDesktopEngine(mode: DesktopMode): DesktopEngine {
  return mode === "support" ? new SupportEngine() : new GameEngine();
}

class SupportEngine implements DesktopEngine {
  readonly mode = "support" as const;

  async check(): Promise<EngineReadiness> {
    const executable = await findRustDesk();
    return executable
      ? { ready: true, code: "ready", message: `RustDesk detectado em ${executable}` }
      : { ready: false, code: "missing-engine", message: "Cliente de suporte nao encontrado neste computador." };
  }

  async start(session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    if (!session.remoteId) return { started: false, message: "O identificador remoto nao foi informado." };
    const executable = await findRustDesk();
    if (!executable) return { started: false, message: "Cliente de suporte nao encontrado neste computador." };

    const child = spawn(executable, ["--connect", session.remoteId], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
    return { started: true, message: "Cliente de suporte iniciado." };
  }

  async stop(_session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    return { started: true, message: "Encerramento solicitado ao cliente de suporte." };
  }
}

class GameEngine implements DesktopEngine {
  readonly mode = "game" as const;

  async check(): Promise<EngineReadiness> {
    return {
      ready: false,
      code: "not-implemented",
      message: "A janela e o decodificador do cliente operador nativo ainda estao em implementacao."
    };
  }

  async start(_session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    const readiness = await this.check();
    return { started: false, message: readiness.message };
  }

  async stop(_session: DesktopSessionDescriptor): Promise<EngineLaunchResult> {
    return { started: false, message: "O cliente operador nativo ainda nao possui uma janela para encerrar." };
  }
}

async function findRustDesk() {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.env.ProgramFiles ?? "C:\\Program Files", "RustDesk", "rustdesk.exe"),
        path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "RustDesk", "rustdesk.exe")
      ]
    : ["/usr/bin/rustdesk", "/usr/local/bin/rustdesk"];

  for (const candidate of candidates) {
    try {
      if (candidate.includes(path.sep)) {
        await fs.access(candidate);
        return candidate;
      }
    } catch {
      // Continue checking the remaining installation locations.
    }
  }

  return os.platform() === "win32" ? null : "rustdesk";
}
