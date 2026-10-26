# Hardening da troca do agente Windows

## Entrega

O instalador Inno agora desabilita temporariamente o inicio automatico do servico antes da atualizacao, encerra a tarefa interativa e confirma pelo caminho completo que `RemotoAgent.exe` e `RemotoAgentService.exe` nao continuam em execucao antes de substituir os arquivos.

Isso reduz o erro `DeleteFile failed; code 5. Acesso negado` observado durante a atualizacao do agente. Se algum processo continuar bloqueando os binarios, o instalador aborta antes de deixar uma instalacao parcial.

## Artefato local

O pacote foi recompilado com FFmpeg embutido e os scripts atuais de configuracao:

- `apps/agent/release/RemotoAgent-Setup.exe`;
- `apps/agent/release/RemotoAgent-Windows.zip`.

O instalador ainda precisa ser executado com aprovacao administrativa na maquina Windows. O diagnostico anterior confirmou que a instalacao antiga continua sem `realtimeUrl` e sem `RemotoAgentDesktop`; isso so muda quando o novo instalador ou o reparo elevado for executado.
