# Entrega 051 - Smoke test local da plataforma

## Objetivo

Validar no workspace local o caminho entre Postgres, API, relay realtime e agente Windows antes da homologacao entre duas maquinas.

## Evidencia executada

Em 25/10/2026, com o Docker Desktop local e o commit `fa642d9`:

1. O Postgres local foi iniciado em `127.0.0.1:55432`.
2. O schema Prisma foi aplicado com `npm run db:push`.
3. O seed local foi executado com segredos temporarios fora do repositorio.
4. A API respondeu `health.ok=true`, `ready.database=ready` e `gameMode=experimental`.
5. O login owner funcionou e o painel/API retornou 2 clientes e 3 dispositivos do seed.
6. O agente registrou `SMOKE-HOST`, enviou heartbeat, inventario e consultou comandos pendentes.
7. Uma sessao `game` foi solicitada, aprovada, consumida pelo cliente e liberada para o papel `host`.
8. O processo `agent:sessions` conectou o host ao relay realtime com a mensagem `sessao remota host conectada`.

## Limite da evidencia

O smoke test nao valida o primeiro frame, teclado, mouse, RTT, perda, reconexao ou compatibilidade de jogos: faltou um segundo cliente conectado ao relay e uma sessao Windows independente. Tambem nao valida audio, gamepad, UAC, bloqueio de tela, anti-cheat ou trafego pela internet.

Os processos API, realtime e agente foram encerrados ao final; o container local do Postgres foi apenas parado, preservando o volume para outro teste local.

## Proximo gate

Executar `docs/entregas/029-runbook-homologacao-jogo.md` com duas maquinas Windows, primeiro na rede local e depois pela internet com HTTPS/WSS.
