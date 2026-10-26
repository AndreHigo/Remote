# Checklist de release atual

## Evidencias concluidas

- fluxo local ponta a ponta aprovado com API, Postgres, agente, inventario, comandos, gate de jogo, relay e captura FFmpeg;
- medicao local atual: primeiro frame `45 ms`, FPS `26,99`, RTT medio/p95 `1/1 ms` e zero descartes;
- `npm run validate:release` aprovado com testes, typecheck, build, sintaxe nativa, hardening do instalador e `npm audit` sem vulnerabilidades;
- preflight de producao aprovado com ambiente temporario valido, compose de producao e instalador local presente;
- instalador Windows recompilado com FFmpeg embutido, configuracao realtime e tarefa interativa;
- commits publicados na branch `main` e workspace limpo.

## Gates antes da VPS

1. Definir segredos reais e exclusivos em `infra/docker/production.env`.
2. Configurar DNS para o dominio do painel e do relay, com portas 80/443 acessiveis para o Caddy.
3. Colocar o instalador Windows assinado em `infra/docker/release/RemotoAgent-Setup.exe`.
4. Executar `npm run deploy:preflight` na VPS e somente entao subir a stack.
5. Instalar o agente em uma segunda maquina Windows usando `https://DOMINIO/api` e `wss://DOMINIO/realtime`.
6. Medir FPS, RTT, perda, reconexao, audio, UAC, tela bloqueada, gamepad e pelo menos um jogo real.

O produto esta pronto para uma homologacao controlada, nao para declarar compatibilidade universal com jogos ou desempenho de internet sem esses gates.
