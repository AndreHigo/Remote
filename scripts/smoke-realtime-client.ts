import { connectRemoteSession, type RealtimeConnection } from "../apps/desktop-control/src/realtime.js";

async function main() {
  const sessionId = required("SMOKE_SESSION_ID");
  const deviceId = required("SMOKE_DEVICE_ID");
  const accessToken = required("SMOKE_ACCESS_TOKEN");
  const realtimeUrl = required("SMOKE_REALTIME_URL");
  let connection: RealtimeConnection | undefined;
  let settled = false;

  const firstFrame = new Promise<void>((resolve, reject) => {
    let timeout: NodeJS.Timeout;
    const succeed = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    timeout = setTimeout(() => fail(new Error("cliente smoke nao recebeu primeiro frame em 20s")), 20_000);

    void connectRemoteSession(
      {
        sessionId,
        deviceId,
        mode: "game",
        role: "client",
        accessToken
      },
      {
        url: realtimeUrl,
        onReady(peerConnected) {
          console.log(`cliente smoke pronto peerConnected=${peerConnected}`);
        },
        onFrame(frame) {
          console.log(`first-frame: ${frame.byteLength} bytes`);
          succeed();
        },
        onClosed(reason) {
          fail(new Error(`cliente smoke encerrou antes do primeiro frame: ${reason}`));
        }
      }
    )
      .then((value) => {
        connection = value;
        if (settled) value.close();
      })
      .catch((error: unknown) => {
        fail(error instanceof Error ? error : new Error(String(error)));
      });
  });

  try {
    await firstFrame;
  } finally {
    connection?.close();
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ausente`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
