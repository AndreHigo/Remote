# Entrega 026 - Arquitetura do cliente nativo operador

## Objetivo

O cliente nativo sera o aplicativo usado pelo tecnico ou jogador para abrir uma sessao aprovada. O agente Windows permanece no computador remoto e atua como host; o cliente operador atua como client.

## Contrato de sessao

O painel cria uma solicitacao `support` ou `game`. Depois da aprovacao administrativa, a API entrega um `desktopSession` com:

- `sessionId` e `deviceId` para vincular a sessao;
- `mode` para separar suporte de jogo;
- `role` para separar host e client;
- `accessToken` assinado, curto e de uso unico;
- `expiresAt` para limitar a janela de abertura.

O cliente nao recebe senha RustDesk nem segredo do relay. O token e consumido pela API e, em seguida, o relay autoriza o canal por um segredo interno separado.

O agente tambem recebe uma `realtimeUrl` explicita na instalacao. Em producao ela deve apontar para o endpoint publico `wss://.../realtime`; nunca deve depender de `localhost` no computador remoto.

## Componentes

```text
Painel web ou cliente nativo
        |
        | POST /desktop-sessions/consume
        v
API Remoto ---- autoriza canal ---- Relay WebSocket
                                      /       \
                                     /         \
                         cliente operador     agente Windows
                         (role client)        (role host)
                                                   |
                                  FFmpeg gdigrab + SendInput
```

### Cliente operador

- abre o descritor aprovado uma unica vez;
- conecta no endpoint `/sessions/:sessionId`;
- envia `hello` com o token;
- recebe frames H.264 fragmented MP4 do host;
- envia somente eventos tipados de teclado, mouse e, futuramente, gamepad;
- exibe estado de conexao, RTT e motivo de encerramento;
- encerra a sessao pela API e fecha o WebSocket.

### Agente host

- consulta sessoes aprovadas a cada poucos segundos;
- solicita o token de host somente para o proprio dispositivo e cliente;
- inicia FFmpeg com CPU por padrao e encoder de GPU como aceleracao opcional;
- encaminha os bytes de `stdout` do FFmpeg ao relay;
- valida os eventos recebidos antes de chamar a ponte Windows `SendInput`;
- encerra captura e entrada quando a sessao ou o peer termina.

## Decisao de produto

O primeiro cliente operador continua sendo web para reduzir barreira de instalacao. O cliente nativo sera uma casca Windows com o mesmo contrato e o mesmo modulo `@remoto/desktop-control`, permitindo trocar apenas a camada de apresentacao e decodificacao.

Isso nao exige Sunshine nem placa de video dedicada. A captura CPU e o fallback acessivel; hardware H.264 e uma otimização quando existir.

## Estado verificavel

- relay autenticado com papeis, expiracao, origem permitida e limite de payload;
- transporte host->client e client->host implementado;
- captura CPU validada localmente;
- encaminhamento de frames pelo `stdout` coberto por teste automatizado;
- cliente web experimental com MSE, teclado, mouse e RTT;
- cliente nativo operador ainda nao possui janela/decodificador final;
- gamepad, audio, clipboard e teste entre duas maquinas ainda nao estao concluidos.

O instalador Windows agora separa o processo de gestao do processo desktop: o servico permanece em modo management-only e o mesmo agente inicia `sessions` no login do usuario. Isso evita depender da Session 0 para captura e `SendInput`; a validacao final ainda precisa ser feita em Windows com usuario logado, bloqueio/desbloqueio e troca de sessao.

## Proxima implementacao do cliente nativo

1. criar a janela Windows/Tauri e carregar o descritor de sessao sem expor token na URL;
2. reutilizar `connectRemoteSession` para o canal autenticado;
3. adicionar decodificador H.264 nativo ou WebView controlada para MSE;
4. mapear entrada com foco, pointer lock e gamepad;
5. exibir diagnostico de codec, RTT, perda e encerramento;
6. validar em duas maquinas, com rede local e internet, antes de habilitar `ENABLE_GAME_MODE` em producao.

