import WebSocket from "ws";
import { startWindowsCapture, type CaptureProfile, type CaptureProcess } from "./capture.js";
import { WindowsInputBridge, validateInputEvent, type RemoteInputEvent } from "./input.js";
import type { DesktopSessionDescriptor } from "./engine.js";

export interface RealtimeClientOptions {
  url?: string;
  capture?: CaptureProfile;
  onFrame?: (frame: Buffer) => void;
  onClosed?: (reason: string) => void;
}

export interface RealtimeConnection {
  readonly socket: WebSocket;
  sendInput(event: RemoteInputEvent): void;
  close(): void;
}

export async function connectRemoteSession(
  session: DesktopSessionDescriptor,
  options: RealtimeClientOptions = {}
): Promise<RealtimeConnection> {
  if (!session.accessToken) throw new Error("Sessao realtime exige accessToken");
  const url = options.url ?? defaultRealtimeUrl(session.sessionId);
  const socket = new WebSocket(url);
  let capture: CaptureProcess | undefined;
  let input: WindowsInputBridge | undefined;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    socket.once("error", fail);
    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "hello", accessToken: session.accessToken }));
    });
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        if (session.role === "client") options.onFrame?.(toBuffer(data));
        return;
      }

      let message: { type?: string; peerConnected?: boolean; reason?: string };
      try {
        message = JSON.parse(toBuffer(data).toString("utf8")) as typeof message;
      } catch {
        fail(new Error("Resposta realtime invalida"));
        return;
      }

      if (message.type === "ready") {
        if (settled) return;
        settled = true;
        socket.off("error", fail);
        if (session.role === "host") {
          try {
            input = new WindowsInputBridge();
            capture = startWindowsCapture(options.capture);
            capture.process.on("data", (chunk) => {
              if (socket.readyState !== WebSocket.OPEN) return;
              // Drop stale chunks instead of building a queue that makes gameplay lag.
              if (socket.bufferedAmount > 4 * 1024 * 1024) return;
              socket.send(chunk);
            });
            capture.process.once("error", (error) => closeWithReason(`captura: ${error.message}`));
          } catch (error) {
            closeWithReason(error instanceof Error ? error.message : String(error));
            fail(error instanceof Error ? error : new Error(String(error)));
            return;
          }
        }
        resolve();
        return;
      }

      if (message.type === "input" && session.role === "host" && input) {
        try {
          input.send(validateInputEvent((message as { event: unknown }).event));
        } catch {
          closeWithReason("entrada-remota-invalida");
        }
        return;
      }

      if (message.type === "closed") {
        options.onClosed?.(message.reason ?? "sessao-encerrada");
        cleanup();
        socket.close(1000, "peer-closed");
      }
    });

    function closeWithReason(reason: string) {
      options.onClosed?.(reason);
      socket.close(1011, reason.slice(0, 120));
    }

    function cleanup() {
      capture?.stop();
      input?.close();
    }

    socket.once("close", cleanup);
  });

  return {
    socket,
    sendInput(event) {
      if (session.role !== "client") throw new Error("Somente o cliente envia entrada");
      const safeEvent = validateInputEvent(event);
      if (socket.readyState !== WebSocket.OPEN) throw new Error("Sessao realtime encerrada");
      socket.send(JSON.stringify({ type: "input", event: safeEvent }));
    },
    close() {
      socket.close(1000, "client-closed");
    }
  };
}

function defaultRealtimeUrl(sessionId: string) {
  const configured = process.env.REMOTO_REALTIME_URL ?? "ws://localhost:4200";
  return `${configured.replace(/\/$/, "")}/sessions/${encodeURIComponent(sessionId)}`;
}

function toBuffer(data: WebSocket.RawData) {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}
