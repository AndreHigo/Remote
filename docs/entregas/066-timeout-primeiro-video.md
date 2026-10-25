# Entrega 066 - Diagnóstico de primeiro vídeo

## Entregue

- O operador nativo e o cliente web armam um timeout de 20 segundos quando o agente entra na sessão, mas ainda não entregou um quadro.
- A mensagem diferencia conexão do relay de captura de vídeo e orienta verificar FFmpeg e atualizar o inventário.
- O timeout é cancelado no primeiro quadro e durante encerramento/reconexão; a sessão não é encerrada automaticamente por esse diagnóstico.

## Validacao

O build do operador, o typecheck do frontend e o CI completo validam o caminho de distribuição. O smoke local continua comprovando que um primeiro quadro real chega pelo relay.

## Limites

O timeout não prova desempenho nem compatibilidade com jogos. Um quadro recebido ainda exige medir FPS, RTT, perda, entrada, áudio e comportamento em duas máquinas Windows.
