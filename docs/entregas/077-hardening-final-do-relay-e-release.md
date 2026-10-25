# Entrega 077: hardening final do relay e release

## Entregue

- A chave de agente ainda nao vinculada nao pode assumir o `remoteId` de um computador ja cadastrado.
- O relay valida teclado, mouse relativo, botoes e roda antes de encaminhar eventos ao host.
- Mensagens de entrada malformadas sao rejeitadas no relay e nao derrubam o host da sessao.
- O preflight de producao exige `rediss://` para o Redis; o exemplo oficial usa TLS.
- O operador so remove o descritor de sessao depois que o consumo do token foi confirmado pela API, permitindo retry em falhas de rede.
- O instalador do agente reaproveita a configuracao existente ao reparar ou atualizar, incluindo a URL do relay e o caminho protegido do FFmpeg.
- Os instaladores locais foram reconstruidos com o codigo final.

## Validacao

- `63` testes automatizados verdes.
- Typecheck e build de todos os pacotes verdes.
- `npm audit --audit-level=high`: zero vulnerabilidades.
- Preflight local de release verde.
- Smoke local de ponta a ponta verde: Postgres, API, agente, inventario, gate game, aprovacao, relay e primeiro frame FFmpeg real.
- CI do commit `ce919f2` verde nos jobs de qualidade e empacotamento Windows.
- Auditoria de seguranca canonica concluida sobre o commit anterior, com tres achados corrigidos nesta entrega: um alto de vinculacao de agente e dois medios de relay e Redis.

## Ainda falta para liberar publicamente

- Instalar em duas maquinas Windows e medir primeiro frame, FPS, RTT, p95, perda e reconexao em LAN e internet.
- Homologar host sem GPU dedicada, GPU integrada e GPU dedicada.
- Validar audio WASAPI com uma build FFmpeg que ofereca `wasapi`; a build local atual permanece video-only.
- Validar gamepad, UAC, tela bloqueada, troca de usuario e jogos protegidos, sem tentar contornar anti-cheat.
- Configurar a VPS com dominio, HTTPS/WSS, Redis TLS, backups e migracoes aplicadas.
- Assinar os executaveis com Authenticode e publicar uma release assinada.
