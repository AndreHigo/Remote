# 060 - Smoke do gate de capacidade do modo jogo

## Entregue

O smoke local agora cobre as duas decisões do fluxo de uma sessão `game`:

1. Cadastra o agente e envia heartbeat, mas tenta aprovar antes do inventário.
2. Confirma que a API recusa a aprovação com HTTP `409`.
3. Nega a solicitação bloqueada.
4. Atualiza o inventário do agente e repete a solicitação.
5. Confirma a aprovação, consome o token de desktop e inicia a sessão host no relay.

Isso evita que o teste fique apenas na função isolada de capacidade e verifica o contrato completo entre agente, API e relay.

## Limite conhecido

O smoke continua sem substituir a homologação em duas máquinas: primeiro frame real, teclado, mouse, latência, perda, reconexão, áudio, gamepad, UAC e tela bloqueada ainda exigem um cliente Windows separado.
