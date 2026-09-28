# Entrega 002: persistencia com Postgres e Prisma

## Entregue

- Postgres local via Docker Compose.
- Prisma 7 configurado na API.
- Schema inicial com:
  - `Customer`;
  - `Device`;
  - `RemoteSession`;
  - `AuditEvent`;
  - `CommandExecution`;
  - `InventorySnapshot`.
- Seed inicial com 2 clientes e 3 dispositivos.
- API migrada de store em memoria para banco persistente.
- Heartbeat gravando `lastSeenAt` no Postgres.
- Solicitacao de sessao remota gravando `RemoteSession` e `AuditEvent`.
- Scripts de banco na raiz:
  - `npm run db:up`;
  - `npm run db:push`;
  - `npm run db:seed`.

## Validacao executada

```bash
npm install
npx prisma validate
npm run typecheck
npm run build
npm run db:up
npm run db:push
npm run db:seed
npm audit
npm run dev
```

Resultado:

- `npx prisma validate`: schema valido.
- `npm run typecheck`: API e web sem erros de TypeScript.
- `npm run build`: API e painel web compilados.
- `npm run db:up`: container `remoto-postgres` iniciado.
- Healthcheck Docker: `healthy`.
- `npm run db:push`: schema aplicado no Postgres.
- `npm run db:seed`: dados iniciais carregados.
- `npm audit`: 0 vulnerabilidades.
- `GET http://localhost:4100/health`: HTTP 200.
- `GET http://localhost:4100/summary`: HTTP 200 com 2 clientes, 3 dispositivos e sessoes persistidas.
- `GET http://localhost:4100/devices`: HTTP 200.
- `POST http://localhost:4100/devices/dev_recepcao_02/heartbeat`: HTTP 200.
- `POST http://localhost:4100/remote-sessions`: HTTP 201.
- `GET http://localhost:4100/audit-events`: HTTP 200.
- `GET http://localhost:5173`: HTTP 200.

## Falta

- Migracoes versionadas em vez de `db push`.
- Autenticacao e autorizacao reais.
- Tenant/organizacao com isolamento formal.
- WebSocket para presenca em tempo real.
- Agente Windows ou CLI simulador.
- Testes automatizados de API.
- Integracao RustDesk.
- Deploy online.

## Proximo passo recomendado

Criar autenticacao inicial com usuarios, papeis e protecao das rotas principais. Depois disso, criar um agente simulado em CLI para registrar dispositivo e enviar heartbeat automaticamente.

