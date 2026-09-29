# Remoto

Plataforma online de acesso remoto, suporte tecnico e gestao de dispositivos.

O objetivo inicial e criar um produto proprio em volta de um motor de acesso remoto ja maduro, com RustDesk como candidato tecnico para o MVP. A plataforma deve oferecer painel web, cadastro de clientes, maquinas online/offline, permissoes, logs, inventario, comandos remotos e uma evolucao controlada para recursos mais avancados.

## Visao curta

Criar uma alternativa brasileira, moderna e simples para operacoes de suporte remoto, com foco em:

- acesso remoto assistido e nao assistido;
- painel online multiempresa;
- seguranca, auditoria e rastreabilidade;
- automacoes tecnicas antes de abrir uma sessao;
- base futura para monitoramento, chamados, inventario e white label.

## Estrutura

```text
apps/
  web/              Painel online para tecnicos, clientes e administradores
  desktop-control/  Futuro app desktop do tecnico
  agent/            Futuro agente instalado no dispositivo remoto
services/
  api/              API principal da plataforma
  realtime/         Presenca, heartbeats e eventos em tempo real
  relay-control/    Integracao/controle de ID server e relay
infra/
  docker/           Ambientes locais e componentes de infraestrutura
  terraform/        Infraestrutura cloud futura
docs/
  00-modo-de-trabalho.md
  01-produto.md
  02-mvp-roadmap.md
  03-arquitetura.md
  04-seguranca.md
  entregas/
  uml/
```

## Como rodar localmente

```bash
npm install
npm run db:up
npm run db:push
npm run db:seed
npm run dev
```

Servicos locais:

- Painel web: `http://localhost:5173`
- API: `http://localhost:4100`
- Postgres: `localhost:55432`

Usuarios seed:

```text
admin@remoto.local / remoto123
tecnico@remoto.local / tecnico123
viewer@remoto.local / viewer123
```

Chave seed do agente:

```text
REMOTO-DEMO-AGENT-KEY
```

Scripts uteis:

```bash
npm run dev
npm run build
npm run typecheck
npm run db:up
npm run db:push
npm run db:seed
npm run agent:register
npm run agent:heartbeat
npm run agent:inventory
npm run agent:commands
npm run agent:loop
npm run agent:config:init
npm run agent:status
npm run agent:service:install
npm run agent:service:uninstall
```

Servidor RustDesk OSS de laboratorio:

```bash
Copy-Item infra/docker/rustdesk.env.example infra/docker/rustdesk.env
docker compose --env-file infra/docker/rustdesk.env -f infra/docker/docker-compose.rustdesk.yml up -d
```

## Decisao inicial

Comecar com uma plataforma online propria e usar RustDesk como motor inicial e referencia tecnica.

Isso evita gastar meses reinventando streaming remoto, NAT traversal, relay e input remoto antes de validar o produto. Ao mesmo tempo, o painel, a experiencia comercial, as permissoes, a auditoria e as automacoes ficam sob nosso controle.

## Proximos passos

1. Validar juridicamente o uso de componentes AGPL como RustDesk.
2. Publicar o servidor RustDesk OSS em VPS com DNS e firewall.
3. Evoluir permissoes mais finas e trocar o rate limit em memoria por Redis.
4. Empacotar o agente e RustDesk em instalador Windows assinado.
5. Testar conexao de tela entre duas maquinas externas.

O botao `Conectar` registra uma solicitacao de sessao; um owner ou admin precisa aprovar antes de abrir o protocolo `rustdesk://`. A conexao de tela depende de RustDesk instalado no computador do tecnico e no dispositivo remoto, ambos apontando para o mesmo `hbbs`/`hbbr`. Contas administrativas ja podem ativar 2FA TOTP no painel; em producao, configure `TOTP_ENCRYPTION_KEY` separado do `JWT_SECRET`.

A API possui `/health` para liveness e `/ready` para readiness com verificacao do PostgreSQL. O workflow em `.github/workflows/ci.yml` valida testes, tipos, build e os Compose antes de qualquer deploy.

Antes da primeira subida da stack de producao, preencha `infra/docker/production.env` a partir do exemplo e execute `npm run deploy:preflight -- -Build`. A stack executa as migracoes, cria o primeiro owner de forma idempotente com `BOOTSTRAP_ADMIN_*` e so depois inicia a API.

## Modo de trabalho

Cada fase deve terminar com uma entrega concreta, validacao executada e uma lista objetiva do que ainda falta. O documento [docs/00-modo-de-trabalho.md](docs/00-modo-de-trabalho.md) registra esse padrao.
