# Entrega 065 - Gate de capacidade na tela de sessão

## Entregue

- O painel só permite selecionar `Jogo` quando o inventário recente do dispositivo publicou `gameModeReady=true`.
- Quando o inventário está ausente ou a captura não está pronta, o seletor explica que o inventário está pendente em vez de deixar o pedido falhar depois na API.
- O modo `Suporte técnico` continua disponível independentemente da capacidade de captura do modo jogo.

## Validacao

O typecheck e o build do frontend verificam o novo fluxo junto com o gate da API. A API continua mantendo a validação no servidor, porque a tela não é uma fronteira de segurança.

## Limites

`gameModeReady` confirma somente a capacidade declarada pelo agente. FPS, latência, áudio, gamepad, UAC, tela bloqueada e compatibilidade com anti-cheat ainda exigem homologação real.
