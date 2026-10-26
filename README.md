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
  desktop-control/  Contrato, captura, entrada e transporte realtime
  operator/         Janela nativa do operador para o modo jogo
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
SEED_CONFIRMATION=RESET_LOCAL_DEMO_DATA SEED_OWNER_PASSWORD='troque-local-owner-123' SEED_TECHNICIAN_PASSWORD='troque-local-tech-123' SEED_VIEWER_PASSWORD='troque-local-viewer-123' SEED_AGENT_KEY='rm_local_agent_key_123456' npm run db:seed
npm run dev
```

Servicos locais:

- Painel web: `http://localhost:5173`
- API: `http://localhost:4100`
- Postgres: `localhost:55432`

Usuarios seed:

```text
O seed e destrutivo e exige `SEED_CONFIRMATION=RESET_LOCAL_DEMO_DATA`. Defina tambem as quatro variaveis `SEED_*` antes de executar; nenhum segredo e impresso nos logs. Nunca execute o seed contra banco de producao.
```

Chave seed do agente:

```text
A chave deve ser informada por `SEED_AGENT_KEY` antes do seed e deve ser rotacionada depois do teste local.
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
npm run operator:package:windows
npm run smoke:local
npm run measure:realtime
```

O `smoke:local` também abre um cliente realtime independente, autentica a sessão aprovada e exige o recebimento do primeiro frame capturado pelo FFmpeg. A evidência e os limites desse teste estão em [`docs/entregas/061-smoke-primeiro-frame.md`](docs/entregas/061-smoke-primeiro-frame.md).

Para uma rodada entre duas máquinas, use `npm run measure:realtime` com os descritores de uma sessão `game` aprovada. O cliente gera FPS, bitrate, tempo do primeiro frame e RTT médio/p95; o procedimento está em [`docs/entregas/067-medicao-realtime-homologacao.md`](docs/entregas/067-medicao-realtime-homologacao.md).

Durante uma sessao de jogo, o operador nativo exibe RTT atual/p95, tempo ate o primeiro frame e volume de video recebido. Esses numeros ajudam a registrar a homologacao, mas nao substituem o teste entre duas maquinas descrito em `docs/entregas/029-runbook-homologacao-jogo.md`.

O painel web tambem permite baixar um relatorio JSON da sessao de jogo. O arquivo registra amostras de RTT, p95, FPS, tempo ate o primeiro frame, reconexoes e frames descartados localmente, facilitando a comparacao entre hosts e redes sem prometer perda de pacotes fim a fim.

O inventario do agente consulta a capacidade real da build do FFmpeg: encoder H.264 escolhido, metodo de captura disponivel, fallback por CPU e WASAPI loopback opcional. Assim, hosts sem GPU dedicada continuam elegiveis quando possuem `libx264`; no perfil `auto`, o fallback por CPU inicia em 30 FPS e 3,5 Mbps para priorizar estabilidade, enquanto encoders acelerados preservam 60 FPS. Audio do sistema so entra na sessao quando `REMOTO_CAPTURE_AUDIO=system` e a build oferece `wasapi`.

Para um pacote de homologacao sem depender de `PATH`, gere o instalador com `-FfmpegPath` apontando para um `ffmpeg.exe` validado. O procedimento e os limites de distribuicao estao em [`docs/entregas/068-pacote-homologacao-com-ffmpeg.md`](docs/entregas/068-pacote-homologacao-com-ffmpeg.md).

O agente tambem possui limite distribuido por credencial quando `REDIS_URL` esta configurada e retencao dos 50 inventarios mais recentes por dispositivo; os detalhes estao em [`docs/entregas/069-limites-de-agente-e-inventario.md`](docs/entregas/069-limites-de-agente-e-inventario.md).

O MFA operacional e a validacao de caminho confiavel do Node no servico Windows estao registrados em [`docs/entregas/070-mfa-operacional-e-node-confiavel.md`](docs/entregas/070-mfa-operacional-e-node-confiavel.md).

O smoke local de regressao do canal game passou com API, agente, relay, captura FFmpeg e primeiro frame real; a evidencia e seus limites estao em [`docs/entregas/071-smoke-local-regressao.md`](docs/entregas/071-smoke-local-regressao.md).

O rate limit distribuido com Redis, incluindo o preflight de producao, esta descrito em [`docs/entregas/072-rate-limit-redis-distribuido.md`](docs/entregas/072-rate-limit-redis-distribuido.md).

O audio opcional pelo mesmo processo FFmpeg e a negociacao assinada de H.264 + AAC estao descritos em [`docs/entregas/074-audio-opcional-wasapi.md`](docs/entregas/074-audio-opcional-wasapi.md).

No instalador Windows, o caminho opcional do `ffmpeg.exe` pode apontar para uma instalacao no perfil do usuario; durante a instalacao elevada ele e copiado para a pasta protegida do Remoto, para que o servico nao execute um binario mutavel do perfil.

Servidor RustDesk OSS de laboratorio:

```bash
Copy-Item infra/docker/rustdesk.env.example infra/docker/rustdesk.env
docker compose --env-file infra/docker/rustdesk.env -f infra/docker/docker-compose.rustdesk.yml up -d
```

## Decisao inicial

Manter a plataforma online, o agente e o cliente desktop sob nosso controle. RustDesk permanece como adaptador de suporte durante a transicao; o modo jogo tera um transporte nativo encapsulado pelo Remoto.

O painel, a experiencia comercial, as permissoes, a auditoria e as automacoes ficam sob nosso controle. O cliente desktop deve esconder detalhes de engine e selecionar captura, codificacao e entrada conforme o hardware. O modo jogo aceita teclado e mouse e oferece um mapa experimental de gamepad para WASD, teclas comuns e mouse. O inventario publica essa capacidade como `keyboard-mouse-map`; isso nao cria um dispositivo XInput/DirectInput no host e fica visivel na ficha do computador.

## Proximos passos

1. Testar suporte e modo jogo entre duas maquinas externas, medindo RTT, FPS, perda e reconexao.
2. Publicar API, painel e relay em VPS com DNS, firewall, TLS e segredos reais.
3. Evoluir permissoes mais finas e configurar Redis compartilhado na VPS.
4. Assinar o instalador Windows e definir atualizacao automatica.
5. Validar o cliente nativo visual em duas maquinas, assinar o instalador e medir a matriz de jogos suportados.

Para uma release Windows com modo jogo, configure no repositorio as variaveis `REMOTO_FFMPEG_URL` e `REMOTO_FFMPEG_SHA256`. O workflow baixa o `ffmpeg.exe`, confere o SHA-256 e valida `RemotoAgent-package.json` antes de empacotar. O binario nao e versionado no Git; mantenha a origem e a licenca correspondentes junto dos artefatos.

O botao `Conectar` registra uma solicitacao de sessao; um owner ou admin precisa aprovar antes de abrir o adaptador correspondente. Sessoes de suporte usam RustDesk quando instalado; sessoes de jogo usam o relay H.264 experimental do proprio Remoto quando `ENABLE_GAME_MODE=true` e os segredos do canal estao configurados. O cliente nativo inicial fica em `apps/operator`, abre descritores de sessao de uso unico e pode ser iniciado pelo `GameEngine`; ele ainda nao e liberado como instalador assinado e nao promete compatibilidade com anti-cheat ou desktop seguro. Owner, admin e tecnico conseguem configurar o proprio 2FA TOTP no painel; em producao, as operacoes remotas ficam bloqueadas ate a ativacao. Configure `TOTP_ENCRYPTION_KEY` e `DESKTOP_SESSION_SECRET` separados do `JWT_SECRET`.

A API possui `/health` para liveness e `/ready` para readiness com verificacao do PostgreSQL. O workflow em `.github/workflows/ci.yml` valida testes, tipos, build e os Compose antes de qualquer deploy.

Antes da primeira subida da stack de producao, preencha `infra/docker/production.env` a partir do exemplo e execute `npm run deploy:preflight -- -Build`. A stack executa as migracoes, cria o primeiro owner de forma idempotente com `BOOTSTRAP_ADMIN_*` e so depois inicia a API.

## Modo de trabalho

Cada fase deve terminar com uma entrega concreta, validacao executada e uma lista objetiva do que ainda falta. O documento [docs/00-modo-de-trabalho.md](docs/00-modo-de-trabalho.md) registra esse padrao.
