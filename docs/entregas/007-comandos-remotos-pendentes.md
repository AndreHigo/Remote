# Entrega 007: comandos remotos pendentes

## Entregue

- Fila de comandos remotos usando `CommandExecution`.
- Enum `CommandExecutionStatus`:
  - `PENDING`;
  - `RUNNING`;
  - `SUCCEEDED`;
  - `FAILED`.
- Campos de execucao:
  - `payload`;
  - `output`;
  - `error`;
  - `startedAt`;
  - `completedAt`;
  - `userId`.
- API autenticada para painel:
  - `POST /devices/:id/commands`;
  - `GET /devices/:id/commands`.
- API para agent:
  - `GET /agent/devices/:id/commands`;
  - `POST /agent/commands/:id/result`.
- Comandos permitidos no MVP:
  - `ping`;
  - `system-info`;
  - `refresh-inventory`.
- Agent CLI executa comandos pendentes com:
  - `npm run agent:commands`.
- Painel web permite criar comandos no detalhe do dispositivo.
- Painel web lista os comandos recentes e seus status.
- Auditoria:
  - `device.command.created`;
  - `device.command.completed`.

## Validacao executada

```bash
npx prisma validate
npm run typecheck
npm run db:push
npm run build
npm audit
npm run db:seed
npm run dev
npm run agent:register
npm run agent:commands
```

Resultado:

- `npx prisma validate`: schema valido.
- `npm run typecheck`: API, web e agent sem erros de TypeScript.
- `npm run db:push`: schema aplicado no Postgres.
- `npm run build`: API, web e agent compilados.
- `npm audit`: 0 vulnerabilidades.
- `npm run db:seed`: dados seed recriados.
- `npm run agent:register`: agent local registrado.
- `POST /devices/:id/commands`: criou comando `system-info` com status `pending`.
- `npm run agent:commands`: executou `system-info` e retornou `succeeded`.
- `GET /devices/:id/commands`: confirmou output com hostname `DESKTOP-DB26883`.
- `GET http://localhost:5173`: HTTP 200.

## Falta

- Loop do agent executando comandos periodicamente.
- Cancelamento de comando pendente.
- Timeout de comando em `RUNNING`.
- Permissoes granulares por tipo de comando.
- Tela mostrando `output` detalhado.
- WebSocket para reduzir polling.
- Assinatura de comandos e chave unica por dispositivo.
- Lista maior de comandos seguros.

## Proximo passo recomendado

Criar loop do agent com heartbeat, coleta de comandos e refresh de inventario em intervalos configuraveis. Isso aproxima o CLI do comportamento de um servico Windows real.

