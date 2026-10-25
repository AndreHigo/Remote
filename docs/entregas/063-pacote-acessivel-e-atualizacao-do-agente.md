# Entrega 063 - Pacote acessivel e atualizacao do agente

## Entregue

- O build Windows aceita `-FfmpegPath` ou `REMOTO_BUNDLE_FFMPEG_PATH` para incluir uma distribuicao validada do FFmpeg no pacote.
- O instalador registra essa copia em `ffmpeg\\ffmpeg.exe` dentro da pasta protegida do Remoto, sem depender do `PATH` do usuario ou de uma GPU dedicada.
- A atualizacao encerra o servico, a tarefa interativa `RemotoAgentDesktop` e os processos conhecidos antes de substituir os binarios, aguardando a saida para reduzir falhas de acesso negado.
- O comportamento continua opcional: quando o pacote nao inclui FFmpeg, o instalador ainda pode usar um caminho informado ou uma instalacao detectada.

## Validacao

O pacote e o instalador devem ser recompilados com `npm run agent:package:windows`. O CI tambem verifica o caminho sem FFmpeg incluido, enquanto uma release que distribua o binario precisa preservar a licenca e a origem da build.

## Limites

Incluir FFmpeg nao prova desempenho, audio WASAPI, gamepad ou compatibilidade com jogos protegidos. Esses pontos continuam exigindo homologacao em duas maquinas Windows.
