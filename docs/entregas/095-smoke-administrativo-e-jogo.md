# Entrega 095 - Smoke administrativo e jogo

## Entregue

- O smoke local agora valida o cadastro e heartbeat do agente, inventario, gate de capacidade do modo jogo, captura FFmpeg, primeiro frame fMP4 e relay realtime.
- O mesmo fluxo arquiva o dispositivo, confirma que a exclusao do cliente retorna `409` enquanto houver dispositivo arquivado e restaura o registro antes de abrir a sessao.

## Limites

- O teste continua sendo local e usa uma unica maquina/processo.
- Entrada real, RTT, perda, reconexao, audio, gamepad e compatibilidade de jogos ainda exigem homologacao em maquinas Windows separadas.
