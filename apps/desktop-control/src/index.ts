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
      const session = JSON.parse(raw) as DesktopSessionDescriptor;
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
