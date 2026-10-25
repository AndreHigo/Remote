import { createDesktopEngine, type DesktopMode, type DesktopSessionDescriptor } from "./engine.js";

const command = process.argv[2] ?? "status";
const mode = (process.argv[3] ?? "support") as DesktopMode;

if (command === "status" && ["support", "game"].includes(mode)) {
  const engine = createDesktopEngine(mode);
  const readiness = await engine.check();
  console.log(JSON.stringify({ mode, readiness }, null, 2));
} else if (command === "open") {
  const raw = process.env.REMOTO_SESSION_DESCRIPTOR ?? process.argv[3];
  if (!raw) {
    console.error("Informe REMOTO_SESSION_DESCRIPTOR ou passe o descritor JSON como argumento.");
    process.exitCode = 2;
  } else {
    try {
      const requestedSession = JSON.parse(raw) as DesktopSessionDescriptor;
      if (!requestedSession.accessToken) throw new Error("Abertura remota exige um token de sessao aprovado.");
      const session = await consumeApprovedSession(requestedSession.accessToken);
      if (!["support", "game"].includes(session.mode) || !["host", "client"].includes(session.role)) {
        throw new Error("Descritor de sessao invalido");
      }
      const result = await createDesktopEngine(session.mode).start(session);
      console.log(JSON.stringify(result, null, 2));
      if (!result.started) process.exitCode = 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
  }
} else {
  console.error("Uso: npm run status -- status support|game | npm run open -w apps/desktop-control -- open <json>");
  process.exitCode = 2;
}

async function consumeApprovedSession(accessToken: string): Promise<DesktopSessionDescriptor> {
  const apiUrl = process.env.REMOTO_API_URL ?? "http://localhost:4100";
  const response = await fetch(`${apiUrl}/desktop-sessions/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken })
  });
  const payload = await response.json().catch(() => ({})) as { message?: string } & DesktopSessionDescriptor;
  if (!response.ok) throw new Error(payload.message ?? `Nao foi possivel consumir a sessao (${response.status})`);
  return payload;
}
