import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getAgentInstallerPath } from "./installer-download.js";

test("nao publica instalador sem caminho configurado", () => {
  assert.equal(getAgentInstallerPath({}), null);
});

test("publica somente um arquivo existente", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "remoto-installer-"));
  const installerPath = path.join(root, "RemotoAgent-Setup.exe");
  fs.writeFileSync(installerPath, "test-installer");
  try {
    assert.equal(getAgentInstallerPath({ REMOTO_AGENT_INSTALLER_PATH: installerPath }), installerPath);
    assert.equal(getAgentInstallerPath({ REMOTO_AGENT_INSTALLER_PATH: root }), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
