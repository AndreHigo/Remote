# Entrega 064 - Limite de entrada no relay

## Entregue

- O relay agora limita eventos `input` por janela de um segundo por conexão cliente.
- O padrão é 1.000 eventos por segundo, suficiente para mouse relativo e teclado em uma sessão normal.
- O limite pode ser ajustado por `REALTIME_MAX_INPUT_EVENTS_PER_SECOND` na operação da infraestrutura.
- A sessão é encerrada com `input-rate-limit` quando o cliente excede o orçamento, preservando memória, CPU e banda do relay.

## Validacao

O teste unitário cobre bloqueio no limite e renovação da janela; a suíte do relay continua cobrindo autenticação, encaminhamento de vídeo/entrada e limites de frames.

## Limites

Esse controle não torna `SendInput` compatível com anti-cheat, UAC, tela segura ou gamepad. Ele protege o transporte e não substitui a homologação de entrada em duas máquinas Windows.
