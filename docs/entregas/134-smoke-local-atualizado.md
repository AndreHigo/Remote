# Smoke local atualizado

## Resultado

Em 26/10/2026, o smoke local de ponta a ponta passou com Postgres, API, agente, inventario, comandos, gate do modo jogo, relay realtime, captura FFmpeg e primeiro frame fMP4.

Na mesma rodada, o fluxo administrativo validou cadastro, movimento e exclusao de cliente, alem do bloqueio de exclusao enquanto existe dispositivo arquivado.

Medicao da sessao local:

- primeiro frame: `45 ms`;
- FPS recebido: `26,99`;
- bitrate: `3401,3 kbps`;
- RTT medio/p95: `1/1 ms`;
- descartes do relay: `0`.

Na segunda rodada, com `CaptureEncoder=auto` e `CaptureMethod=auto`, o host usou o caminho acelerado disponivel e registrou primeiro frame de `40 ms`, `26,96 FPS`, `3442,66 kbps`, RTT medio/p95 de `1/1 ms` e zero descartes.

O FPS agora conta samples de video dos fragmentos fMP4, e nao apenas a quantidade de segmentos recebidos.

## Limites

Esse resultado prova o fluxo local no mesmo computador. Ainda faltam homologacao entre duas maquinas Windows, teste pela internet, audio WASAPI, gamepad, UAC, tela bloqueada, troca de usuario e compatibilidade por jogo/anti-cheat.
