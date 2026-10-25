# Entrega 024 - Cliente web experimental do modo jogo

## Entregue

- O painel consome o token aprovado uma unica vez e abre a sessao realtime no proprio workspace.
- Player H.264 via Media Source Extensions para fragmentos MP4 de baixa latencia.
- Captura de mouse relativo por pointer lock, botoes, roda e teclado por scancode.
- Encerramento visual da sessao e limpeza do WebSocket, fila de media e URL temporaria.
- Modo jogo permanece desativado por padrao com `ENABLE_GAME_MODE=false`.
- Quando habilitado explicitamente, a API devolve uma sessao `native-game`; o agente conecta como host e o painel abre o cliente web experimental como operador.

## Limite atual

O fluxo ainda e experimental. A fila MSE, o codec H.264, o pointer lock e os perfis de captura precisam ser validados em Chrome/Edge com duas maquinas Windows, redes diferentes e jogos reais. Nao foi declarado suporte a anti-cheat, gamepad ou 4K.

## Como testar depois da validacao local

1. Definir `ENABLE_GAME_MODE=true` somente no ambiente de teste.
2. Subir API, web e realtime com `REALTIME_INTERNAL_SECRET` igual na API e no relay.
3. Instalar FFmpeg no computador remoto e iniciar o agente com a mesma API.
4. Solicitar uma sessao em modo jogo, aprovar no painel e clicar dentro do video para capturar o mouse.
5. Registrar FPS, RTT, perda, CPU, GPU e comportamento ao encerrar.

O padrao continua sendo suporte via RustDesk. O modo jogo deve permanecer experimental ate que os testes externos e a matriz de jogos definam os limites suportados.
