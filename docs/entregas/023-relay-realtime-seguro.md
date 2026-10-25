# Entrega 023 - Relay realtime seguro

## Entregue

- Servico `services/realtime` com salas por sessao e papeis separados de `host` e `client`.
- Frames binarios somente do host para o cliente.
- Eventos de teclado e mouse somente do cliente para o host.
- Limite de payload, timeout de hello, bloqueio de papeis duplicados e limpeza ao desconectar.
- Token de cliente de uso unico, com hash no banco, expiracao e conferencia de sessao aprovada.
- Token de host temporario emitido somente para o agente autenticado do dispositivo.
- Captura Windows com FFmpeg, CPU como padrao e descarte de fila atrasada para preservar latencia.
- Ponte de entrada Windows restrita a eventos tipados e `SendInput`.
- Servico realtime, proxy WebSocket, healthcheck e segredo interno adicionados ao compose de producao.

## Limite atual

O relay e a captura/entrada nativos estao prontos como fundacao de transporte, mas o produto ainda nao deve habilitar o modo jogo para usuarios finais. Falta o cliente visual que decodifica os frames, captura foco/teclado/mouse e mede a experiencia em duas maquinas reais.

O modo suporte continua usando RustDesk. Essa escolha nao mistura os protocolos no mesmo fluxo: cada sessao declara o modo e recebe somente o transporte correspondente.

## Criterio para habilitar jogo

1. Implementar cliente visual com fila de frames e controle de foco.
2. Fazer teste de duas maquinas Windows em redes diferentes.
3. Medir FPS, RTT, perda, bitrate, uso de CPU/GPU e tempo de reconexao.
4. Validar teclado, mouse relativo, controle e encerramento administrativo.
5. Habilitar o modo somente com uma flag de producao apos os testes, mantendo o padrao desativado ate la.

## Validacao desta entrega

```powershell
npm run typecheck
npm run test:security
npm run test -w apps/desktop-control
npm run test -w services/realtime
npm audit --audit-level=high
docker compose --env-file infra/docker/production.env.example -f infra/docker/docker-compose.production.yml config --quiet
```
