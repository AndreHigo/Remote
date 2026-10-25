# Remoto

Plataforma online de acesso remoto, suporte tecnico e gestao de dispositivos.

O objetivo e criar um produto proprio de acesso remoto com painel web, agente Windows, cliente desktop unico, cadastro de clientes, maquinas online/offline, permissoes, logs, inventario, comandos remotos e um modo jogo acessivel por hardware.

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
  desktop-control/  Contrato e cliente desktop nativo em evolucao
  agent/            Agente instalado no dispositivo remoto
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

Manter a plataforma online, o agente e o cliente desktop sob nosso controle. RustDesk permanece como adaptador de suporte durante a transicao; o modo jogo tera um transporte nativo encapsulado pelo Remoto.

O painel, a experiencia comercial, as permissoes, a auditoria e as automacoes ficam sob nosso controle. O cliente desktop deve esconder detalhes de engine e selecionar captura, codificacao e entrada conforme o hardware.

## Proximos passos

1. Implementar captura, codificacao, transporte e entrada do cliente nativo.
2. Publicar os componentes de suporte em VPS com DNS e firewall.
3. Evoluir permissoes mais finas e trocar o rate limit em memoria por Redis.
4. Empacotar agente e cliente Remoto em instalador Windows assinado.
5. Testar suporte e modo jogo entre duas maquinas externas.

O botao `Conectar` registra uma solicitacao de sessao; um owner ou admin precisa aprovar antes de abrir o adaptador correspondente. Sessoes de suporte usam RustDesk quando instalado; sessoes de jogo usam o relay H.264 experimental do proprio Remoto quando `ENABLE_GAME_MODE=true` e o segredo interno do relay estao configurados. O cliente nativo visual continua separado e ainda nao esta liberado. Contas administrativas ja podem ativar 2FA TOTP no painel; em producao, configure `TOTP_ENCRYPTION_KEY` separado do `JWT_SECRET`.

A API possui `/health` para liveness e `/ready` para readiness com verificacao do PostgreSQL. O workflow em `.github/workflows/ci.yml` valida testes, tipos, build e os Compose antes de qualquer deploy.

Antes da primeira subida da stack de producao, preencha `infra/docker/production.env` a partir do exemplo e execute `npm run deploy:preflight -- -Build`. A stack executa as migracoes, cria o primeiro owner de forma idempotente com `BOOTSTRAP_ADMIN_*` e so depois inicia a API.

## Modo de trabalho

Cada fase deve terminar com uma entrega concreta, validacao executada e uma lista objetiva do que ainda falta. O documento [docs/00-modo-de-trabalho.md](docs/00-modo-de-trabalho.md) registra esse padrao.
