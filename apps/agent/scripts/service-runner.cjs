const path = require("node:path");
const { spawn } = require("node:child_process");

const agentRoot = path.resolve(__dirname, "..");
const entryPoint = path.join(agentRoot, "dist", "index.js");

process.chdir(agentRoot);
process.env.REMOTO_AGENT_CONFIG ??= path.join(agentRoot, ".remoto-agent.config.json");
process.env.REMOTO_AGENT_STATE ??= path.join(agentRoot, ".remoto-agent.json");

const child = spawn(process.execPath, [entryPoint, "loop"], {
  cwd: agentRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`Falha ao iniciar o agente: ${error.message}`);
  process.exit(1);
});
