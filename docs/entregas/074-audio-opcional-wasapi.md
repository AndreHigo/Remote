# 074 - Audio opcional pelo mesmo FFmpeg

## Entregue

- O perfil do agente aceita `REMOTO_CAPTURE_AUDIO=off|system`; `off` continua sendo o padrao acessivel e video-only.
- `system` usa o input WASAPI loopback do FFmpeg e codifica AAC junto do H.264 no mesmo fMP4.
- O inventario consulta a presenca de `wasapi` na build local e impede o gate do modo jogo quando o audio foi solicitado mas nao esta disponivel.
- A capacidade de audio viaja no token assinado da sessao; web e Operator escolhem MIME H.264 + AAC quando o host anuncia `system`.
- O relay recusa host e cliente com capacidades de audio diferentes, evitando uma sessao cuja decodificacao nao corresponda ao stream.

## Validacao

- Testes de montagem dos argumentos WASAPI e do gate de capacidade.
- Teste do MIME H.264 + AAC no cliente nativo.
- Typecheck e build completos continuam obrigatorios.

## Limites

O FFmpeg instalado nesta maquina nao oferece WASAPI loopback, portanto a capacidade real de audio ainda precisa ser homologada em Windows com uma build que contenha `wasapi`, incluindo dispositivo de saida, sincronismo e comportamento em jogos. Isso nao altera o fallback de video/CPU.
