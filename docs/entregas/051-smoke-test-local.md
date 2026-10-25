# Entrega 051 - Smoke test local da plataforma

## Objetivo

Validar no workspace local o caminho entre Postgres, API, relay realtime e agente Windows antes da homologacao entre duas maquinas.

## Evidencia executada

Em 25/10/2026, com o Docker Desktop local e o commit `35b516b`:

1. O Postgres local foi iniciado em `127.0.0.1:55432`.
2. O schema Prisma foi aplicado com `npm run db:push`.
3. O seed local foi executado com segredos temporarios fora do repositorio.
4. A API respondeu `health.ok=true`, `ready.database=ready` e `gameMode=experimental`.
5. O login owner funcionou e o painel/API retornou 2 clientes e 3 dispositivos do seed.
6. O agente registrou `SMOKE-HOST`, enviou heartbeat, inventario e consultou comandos pendentes.
7. Uma sessao `game` foi solicitada, aprovada, consumida pelo cliente e liberada para o papel `host`.
8. O processo `agent:sessions` conectou o host ao relay realtime com a mensagem `sessao remota host conectada`.
9. O diagnostico do host confirmou FFmpeg, encoders H.264 NVIDIA/AMD/Intel e `ddagrab`; a build local nao oferece WASAPI loopback.
10. O mesmo diagnostico confirmou que a configuracao instalada da maquina ainda estava sem `realtimeUrl` e sem a tarefa `RemotoAgentDesktop`, deixando o reparo claramente apontado no relatorio.

O procedimento foi consolidado no comando `npm run smoke:local`. Ele usa segredos temporarios no processo, nao grava credenciais no repositorio e para API, relay e Postgres ao terminar, salvo quando executado com `-KeepPostgres`.

## Limite da evidencia

O smoke test nao valida o primeiro frame, teclado, mouse, RTT, perda, reconexao ou compatibilidade de jogos: faltou um segundo cliente conectado ao relay e uma sessao Windows independente. Tambem nao valida audio, gamepad, UAC, bloqueio de tela, anti-cheat ou trafego pela internet.

Os processos API, realtime e agente foram encerrados ao final; o container local do Postgres foi apenas parado, preservando o volume para outro teste local.

Na maquina Windows usada para o diagnostico, o servico `RemotoAgent` estava em execucao, mas a tarefa interativa `RemotoAgentDesktop` ainda nao estava instalada. Portanto, o host possui capacidade de captura publicada, mas ainda precisa ser reinstalado/configurado pelo pacote oficial elevado antes de uma sessao de jogo real.

## Proximo gate

Executar `docs/entregas/029-runbook-homologacao-jogo.md` com duas maquinas Windows, primeiro na rede local e depois pela internet com HTTPS/WSS.
