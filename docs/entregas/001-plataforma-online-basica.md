# Entrega 001: plataforma online basica

## Entregue

- Base npm em monorepo.
- API MVP em `services/api`.
- Painel web MVP em `apps/web`.
- Listagem de clientes e dispositivos.
- Status online/offline calculado por heartbeat.
- Acao para simular heartbeat.
- Acao para registrar solicitacao de sessao remota.
- Atividade recente por eventos de auditoria.

## Validacao executada

```bash
npm install
npm run typecheck
npm run build
npm audit
```

Resultado:

- `npm install`: dependencias instaladas e audit final sem vulnerabilidades.
- `npm run typecheck`: API e web sem erros de TypeScript.
- `npm run build`: API compilada e painel web gerado para producao.
- `npm audit`: 0 vulnerabilidades.
- `npm run dev`: API e painel iniciados localmente.
- `GET http://localhost:4100/health`: HTTP 200.
- `GET http://localhost:4100/devices`: HTTP 200.
- `GET http://localhost:5173`: HTTP 200.

Endpoints principais:

```text
GET  http://localhost:4100/health
GET  http://localhost:4100/summary
GET  http://localhost:4100/devices
POST http://localhost:4100/devices/:id/heartbeat
POST http://localhost:4100/remote-sessions
```

Painel:

```text
http://localhost:5173
```

## Falta

- Persistencia real em banco de dados.
- Autenticacao e usuarios reais.
- Agente instalado em Windows.
- Integracao real com RustDesk.
- WebSocket para presenca em tempo real.
- Testes automatizados.
- Deploy online.

## Proximo passo recomendado

Adicionar PostgreSQL, schema inicial e API com persistencia real para clientes, dispositivos, heartbeat, sessoes e auditoria.
