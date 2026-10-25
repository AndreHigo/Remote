const esbuild = require("esbuild");

const version = process.env.REMOTO_AGENT_VERSION || "0.1.0";

esbuild.build({
  entryPoints: ["apps/agent/src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  define: { __REMOTO_AGENT_VERSION__: JSON.stringify(version) },
  outfile: "apps/agent/dist/standalone.cjs"
}).catch(() => process.exit(1));
