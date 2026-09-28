# Entrega 016 - operacao de sessao e backup

## Entregue

- Endpoint autenticado `POST /remote-sessions/:id/end`.
- Estado `ENDED` e `endedAt` persistidos.
- Auditoria de encerramento da sessao.
- Script PowerShell de backup com `pg_dump`.
- Validacao de arquivo de backup nao vazio.

## Antes da VPS

- Agendar o script em rotina externa ou Task Scheduler.
- Copiar os arquivos para armazenamento fora da VPS.
- Testar restauracao em banco separado e registrar o tempo de recuperacao.
- Confirmar que encerrar o registro tambem encerra o cliente RustDesk conforme o comportamento escolhido para o desktop-control.
