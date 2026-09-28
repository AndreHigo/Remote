# Docker

Ambiente local e infraestrutura de desenvolvimento.

Componentes provaveis:

- PostgreSQL;
- Redis;
- API;
- Realtime;
- servidor RustDesk OSS para laboratorio;
- ferramentas de observabilidade locais.

## RustDesk OSS local

O servidor de acesso remoto fica em um compose separado para nao iniciar junto com o banco por acidente:

```bash
$env:RUSTDESK_RELAY_HOST="127.0.0.1" # troque pelo DNS/IP do servidor em rede externa
docker compose -f infra/docker/docker-compose.rustdesk.yml up -d
```

O compose exige esse valor para nao anunciar `localhost` por engano em uma instalacao entre maquinas. Um arquivo de exemplo esta em `infra/docker/rustdesk.env.example`.

Em um VPS, `RUSTDESK_RELAY_HOST` deve ser o DNS publico do relay. O servidor gera a chave publica em `id_ed25519.pub` dentro do volume `remoto-rustdesk-data`; essa chave deve ser configurada nos clientes RustDesk.

Portas OSS usadas pelo stack:

- `21115/tcp`: teste de NAT do `hbbs`;
- `21116/tcp` e `21116/udp`: ID/rendezvous;
- `21117/tcp`: relay;
- `21118/tcp` e `21119/tcp`: WebSocket, somente quando houver proxy seguro e necessidade do web client.

## Postgres local

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
```

Banco padrao:

```text
postgresql://remoto:remoto@localhost:55432/remoto?schema=public
```

## Stack de producao para VPS

Copie `production.env.example` para `production.env`, troque todos os valores e aponte `WEB_DOMAIN` e `RUSTDESK_RELAY_HOST` para DNS publico. Depois:

```bash
Copy-Item infra/docker/production.env.example infra/docker/production.env
docker compose --env-file infra/docker/production.env -f infra/docker/docker-compose.production.yml up -d --build
```

Antes do `up`, rode o preflight. Ele bloqueia placeholders, dominios de exemplo, localhost e segredos curtos:

```powershell
npm run deploy:preflight
npm run deploy:preflight -- -Build
```

A stack executa a migration versionada antes da API, publica o painel com HTTPS automatico pelo Caddy e mantem PostgreSQL sem porta publica. Libere no firewall somente `80/tcp`, `443/tcp`, `21115/tcp`, `21116/tcp+udp`, `21117/tcp`, `21118/tcp` e `21119/tcp`, conforme os recursos realmente usados.

Com a stack em execucao, gere um backup local do banco antes de mudancas:

```powershell
powershell -ExecutionPolicy Bypass -File infra/docker/backup-postgres.ps1
```
