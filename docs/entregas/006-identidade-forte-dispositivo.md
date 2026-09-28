# Entrega 006: identidade forte do dispositivo

## Entregue

- Campos de identidade no modelo `Device`:
  - `biosSerial`;
  - `systemUuid`;
  - `primaryMac`;
  - `identityHash`.
- API aceita identidade forte no cadastro de dispositivo.
- Registro de dispositivo tenta reaproveitar maquina existente por prioridade:
  - `identityHash`;
  - `systemUuid`;
  - `biosSerial`;
  - `primaryMac`;
  - `remoteId`.
- Auditoria diferencia:
  - `device.registered`;
  - `device.reidentified`.
- Agent CLI coleta:
  - serial BIOS via WMI/CIM no Windows, quando disponivel;
  - UUID do sistema via WMI/CIM no Windows, quando disponivel;
  - MAC principal;
  - hash de identidade.
- Inventario tambem inclui o bloco `hardware.identity`.
- Painel web mostra MAC principal, serial BIOS e UUID do sistema no detalhe do dispositivo.
- Seed atualizado com identidades ficticias para os dispositivos demo.

## Validacao executada

```bash
npx prisma validate
npm run typecheck
npm run db:up
npm run db:push
npm run db:seed
npm run build
npm audit
npm run dev
npm run agent:register
npm run agent:inventory
```

Resultado:

- `npx prisma validate`: schema valido.
- `npm run typecheck`: API, web e agent sem erros de TypeScript.
- `npm run db:up`: Docker/Postgres iniciado apos Docker Desktop estar parado.
- `npm run db:push`: schema aplicado no Postgres.
- `npm run db:seed`: dados recriados com identidades seed.
- `npm run build`: API, web e agent compilados.
- `npm audit`: 0 vulnerabilidades apos `npm audit fix`.
- `npm run agent:register`: registrou a maquina local com `systemUuid`, `primaryMac` e `identityHash`.
- `npm run agent:inventory`: salvou snapshot com `hardware.identity`.
- Consulta autenticada confirmou:
  - `SystemUuid`: `B0C28570-934B-0000-0000-000000000000`;
  - `PrimaryMac`: `70:85:c2:b0:4b:93`;
  - `IdentityHash`: presente e igual no dispositivo e no inventario.
- Segundo `npm run agent:register`: nao duplicou a maquina; total permaneceu em 4 dispositivos.
- `GET http://localhost:5173`: HTTP 200.

## Falta

- Tratar casos de serial/UUID genericos por fabricante com lista maior.
- Guardar historico de mudanca de identidade.
- Exigir chave unica por dispositivo depois do primeiro pareamento.
- Criar tela de conflito quando duas maquinas tiverem sinais parecidos.
- Coletar lista de programas instalados.
- Migracoes versionadas em vez de `db push`.

## Proximo passo recomendado

Criar comandos remotos pendentes: o painel/API registra um comando simples para o dispositivo, e o agent consulta/executa comandos permitidos como `ping`, `system-info` ou `refresh-inventory`.

