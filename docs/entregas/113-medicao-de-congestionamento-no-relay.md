# Entrega 113 - Medicao de congestionamento no relay

O comando `npm run measure:realtime` agora inclui no JSON de homologacao:

- `relayDroppedFrames`: quantidade de frames que o relay confirmou ter descartado por congestionamento da fila do cliente;
- `relayDroppedBytes`: volume correspondente em bytes;
- FPS, bitrate, primeiro frame e RTT medio/p95, mantidos no mesmo relatorio.

Os contadores do relay nao representam perda IP nem todos os descartes possiveis da rede. Eles identificam congestionamento observado no WebSocket do relay e devem ser analisados junto com RTT, FPS, reconexoes e a experiencia dentro do jogo.

Para medir, rode o cliente com `MEASURE_OUTPUT_PATH` definido. O arquivo resultante pode ser comparado entre LAN, internet, CPU fallback, GPU integrada e GPU dedicada.
