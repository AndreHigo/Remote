# Entrega 005: inventario basico pelo agent

## Entregue

- Endpoint de coleta por agente:
  - `POST /agent/devices/:id/inventory`.
- Endpoint autenticado de consulta:
  - `GET /devices/:id/inventory`.
- Persistencia em `InventorySnapshot`.
- Auditoria `device.inventory.collected`.
- Comando CLI:
  - `npm run agent:inventory`.
- Coleta basica da maquina:
  - hostname;
  - sistema operacional;
  - arquitetura;
  - uptime;
  - CPU;
  - memoria;
  - discos;
  - interfaces IPv4;
  - runtime do agent.
- Painel web mostra o ultimo inventario no detalhe do dispositivo selecionado.

## Validacao executada

```bash
npx prisma validate
npm run typecheck
npm run build
npm audit
npm run dev
npm run agent:inventory
```

Resultado:

- `npx prisma validate`: schema valido.
- `npm run typecheck`: API, web e agent sem erros de TypeScript.
- `npm run build`: API, web e agent compilados.
- `npm audit`: 0 vulnerabilidades.
- Postgres `remoto-postgres`: healthy.
- `npm run agent:inventory`: criou snapshot `InventorySnapshot`.
- `GET /devices/:id/inventory`: retornou 1 snapshot para a maquina local.
- Inventario validado com CPU `AMD Ryzen 5 2600 Six-Core Processor` e 3 discos.
- `GET http://localhost:5173`: HTTP 200.

## Falta

- Coleta de programas instalados.
- Coleta de serial BIOS/UUID/MAC como identidade forte.
- Normalizacao e deduplicacao de componentes.
- Historico comparativo entre snapshots.
- Alertas baseados em inventario.
- Assinatura e isolamento do agente.
- Coleta rodando em loop/servico Windows.

## Proximo passo recomendado

Adicionar identidade forte do dispositivo no agent: serial BIOS, UUID, MAC principal e hostname. Isso evita duplicar ou sobrescrever maquina errada quando o agente virar instalador real.

