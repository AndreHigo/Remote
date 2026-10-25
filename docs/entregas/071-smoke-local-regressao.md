# 071 - Smoke local de regressao do canal game

## Resultado

Em 25/10/2026, `npm run smoke:local` passou em uma maquina Windows com Docker Desktop e FFmpeg local.

O fluxo validado foi:

- PostgreSQL local, `db:push` e seed;
- API `/health` e `/ready`;
- cadastro do agente e heartbeat;
- bloqueio de aprovacao game sem inventario atualizado;
- coleta de inventario e comandos;
- aprovacao da sessao game depois da capacidade publicada;
- host do agente conectado ao relay;
- cliente realtime recebendo o primeiro frame fMP4 real da captura FFmpeg.

## Limites

O smoke usa processos locais e um unico computador. Ele nao prova RTT, perda, teclado, mouse, audio, gamepad, UAC, tela bloqueada, troca de usuario, anti-cheat ou funcionamento pela internet. Esses pontos continuam no runbook de homologacao entre duas maquinas Windows.
