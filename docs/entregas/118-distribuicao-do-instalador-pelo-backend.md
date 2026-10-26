# Entrega 118 - Distribuicao do instalador pelo backend

O onboarding do painel agora baixa o instalador a partir de `/api/downloads/agent` por padrao em producao. A API so responde com o arquivo quando `REMOTO_AGENT_INSTALLER_PATH` aponta para um instalador existente; caso contrario retorna `404` e o painel informa que a distribuicao ainda nao foi configurada.

## Publicacao na VPS

1. Copie o `RemotoAgent-Setup.exe` assinado para `infra/docker/release/RemotoAgent-Setup.exe` antes do deploy.
2. O Compose monta esse diretorio como `/opt/remoto/releases:ro` e configura `REMOTO_AGENT_INSTALLER_PATH` para `/opt/remoto/releases/RemotoAgent-Setup.exe`.
3. Execute `powershell -File infra/docker/preflight-production.ps1` e confirme `GET /health` com `agentInstaller: "available"` depois da subida.
4. Abra o onboarding, gere a chave e baixe o perfil e o instalador. Os dois arquivos devem ser levados juntos para o computador host.

O perfil continua contendo a chave de cadastro de uso inicial e deve ser tratado como segredo. A URL do instalador nao carrega chave, token ou identificador de cliente. Para CDN ou armazenamento externo, defina `VITE_AGENT_INSTALLER_URL` no build do painel e mantenha `REMOTO_AGENT_INSTALLER_PATH` ausente.
