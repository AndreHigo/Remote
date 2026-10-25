# Entrega 078 - Diagnostico do FFmpeg configurado

## Entregue

- O diagnostico do host agora le o `ffmpegPath` gravado na configuracao protegida do agente antes de sondar o `PATH` do usuario.
- Um FFmpeg empacotado em `Program Files` ou descoberto em uma raiz protegida passa a ser reconhecido como disponivel para o servico.
- O relatorio publica `capture.ffmpegSource` com `agent-config`, `PATH` ou `protected-discovery`.
- O preflight valida que o diagnostico nao regresse para uma sondagem que ignore a configuracao protegida.

## Limite

Esta correcao melhora a evidencia de capacidade, mas nao transforma um FFmpeg sem WASAPI em captura de audio nem substitui a homologacao em duas maquinas Windows.
