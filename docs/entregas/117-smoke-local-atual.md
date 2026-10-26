# Entrega 117 - Smoke local atual

Em 26/10/2026, o comando `npm run smoke:local` foi executado no estado atual do `main` e aprovou o fluxo completo local:

- Postgres local, schema e seed;
- API e relay realtime iniciados;
- cadastro, heartbeat, inventario e consulta de comandos do agente;
- bloqueio correto de sessao de jogo sem inventario pronto;
- bloqueio correto de exclusao de cliente com dispositivo arquivado;
- host do agente, cliente realtime, captura FFmpeg e primeiro frame;
- aprovacao e encerramento do fluxo de sessao `game` no relay.

O smoke usa processos locais e uma unica maquina. Ele nao prova entrada real, RTT/perda de internet, audio, gamepad, UAC, tela bloqueada, anti-cheat ou compatibilidade entre dois computadores Windows.
