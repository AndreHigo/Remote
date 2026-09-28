# Entrega 004: agent CLI simulado

## Entregue

- Modelo `AgentEnrollmentKey` no Prisma.
- Chave de agente com hash SHA-256 no banco.
- Seed com chave demo `REMOTO-DEMO-AGENT-KEY`.
- Middleware `authenticateAgent` usando header `x-agent-key`.
- Rotas publicas protegidas por chave de agente:
  - `POST /agent/devices/register`;
  - `POST /agent/devices/:id/heartbeat`.
- CLI simulado em `apps/agent`.
- Comandos raiz:
  - `npm run agent:register`;
  - `npm run agent:heartbeat`.
- Estado local do agente em `.remoto-agent.json`, ignorado pelo Git.

## Validacao executada

```bash
npx prisma validate
npm run db:push
npm run db:seed
npm run typecheck
npm run build
npm audit
npm run dev
npm run agent:register
npm run agent:heartbeat
```

Resultado:

- `npx prisma validate`: schema valido.
- `npm run typecheck`: API, web e agent sem erros de TypeScript.
- `npm run build`: API, web e agent compilados.
- `npm run db:push`: schema aplicado no Postgres.
- `npm run db:seed`: dados seed e chave demo recriados.
- `npm audit`: 0 vulnerabilidades.
- `GET http://localhost:4100/health`: HTTP 200.
- `POST /agent/devices/dev_financeiro_01/heartbeat` com chave invalida: HTTP 401.
- `npm run agent:register`: registrou a maquina local como dispositivo online.
- `npm run agent:heartbeat`: atualizou `lastSeenAt` da maquina local.
- `GET http://localhost:5173`: HTTP 200.
- `GET /summary` autenticado: 2 clientes, 4 dispositivos e 3 online apos registrar o agente local.

## Falta

- Binario/servico Windows real.
- Instalador assinado.
- Atualizacao automatica do agente.
- Chave por dispositivo em vez de chave de enrolamento compartilhada.
- Revogacao e rotacao de chaves pelo painel.
- Coleta real de inventario.
- Canal WebSocket para comandos.

## Proximo passo recomendado

Criar inventario basico do agente: CPU, RAM, disco, SO, usuario, hostname e IP, salvando em `InventorySnapshot`.
