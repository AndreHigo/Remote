import { connectRemoteSession, type RealtimeClientOptions, type RealtimeConnection } from "./realtime.js";
import type { DesktopSessionDescriptor } from "./engine.js";

export interface NativeOperatorOptions {
  url?: string;
  onFrame?: (frame: Buffer) => void;
  onReady?: (peerConnected: boolean) => void;
  onClosed?: (reason: string) => void;
}

export interface NativeOperatorSession {
  readonly descriptor: DesktopSessionDescriptor;
  readonly connection: RealtimeConnection;
  sendInput(event: Parameters<RealtimeConnection["sendInput"]>[0]): void;
  close(): void;
}

/**
 * Stable boundary for the native operator window. Rendering and window
 * management stay outside this module; the session transport remains shared.
 */
export async function openNativeOperatorSession(
  descriptor: DesktopSessionDescriptor,
  options: NativeOperatorOptions = {}
): Promise<NativeOperatorSession> {
  if (descriptor.role !== "client") throw new Error("O cliente operador exige uma sessao com role client.");
  if (descriptor.mode !== "game") throw new Error("O cliente operador nativo suporta o modo jogo nesta fase.");

  const connectionOptions: RealtimeClientOptions = {
    url: options.url,
    onFrame: options.onFrame,
    onReady: options.onReady,
    onClosed: options.onClosed
  };
  const connection = await connectRemoteSession(descriptor, connectionOptions);

  return {
    descriptor,
    connection,
    sendInput(event) {
      connection.sendInput(event);
    },
    close() {
      connection.close();
    }
  };
}
