# Entrega 020 - Fundacao do modo jogo

## Entregue

- `RemoteSession` agora registra o modo `support` ou `game`.
- O painel permite escolher o modo ao solicitar acesso.
- Auditoria e listagem exibem o modo escolhido.
- Sessoes de suporte continuam abrindo RustDesk.
- Sessoes de jogo podem ser aprovadas somente quando `ENABLE_GAME_MODE=true` e `REALTIME_INTERNAL_SECRET` estao configurados; sem isso a API continua devolvendo conflito `native-game/not-ready`.
- O painel possui um cliente web experimental com video H.264 e entrada tipada; o cliente desktop nativo inicial fica em `apps/operator` e continua separado do fluxo de suporte.

## Proxima validacao

O proximo trabalho e validar o cliente nativo Windows em duas maquinas e medir os perfis de captura. O painel, o cliente web e o operador nativo usam a mesma sessao aprovada sem misturar o fluxo de suporte.

## Validacao

Antes de habilitar `game` em producao, validar em uma maquina Windows real:

- captura acelerada pela GPU;
- 1080p/60 FPS;
- teclado, mouse relativo e controle;
- conexao direta e relay;
- latencia, perda de pacotes e compatibilidade com o jogo escolhido;
- comportamento de anti-cheat sem tentar contorna-lo.
