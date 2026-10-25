# Entrega 032 - Segmentacao fMP4 para baixa latencia

## Entregue

- o transporte do host agora acumula bytes do FFmpeg e identifica caixas ISO BMFF completas;
- `ftyp` e `moov` sao enviados juntos como segmento de inicializacao;
- cada unidade `moof` + `mdat` e enviada como um segmento de media completo;
- o controle de congestionamento descarta somente segmentos de media inteiros, nunca um pedaço de caixa;
- o relay continua recebendo frames abaixo do limite de 8 MiB;
- o teste cobre chunks divididos em limites arbitrarios e a integracao host/cliente.

## Validacao

```powershell
npm test -w apps/desktop-control
npm run typecheck -w apps/desktop-control
npm run build
npm run operator:package:windows
```

Instalador operador gerado: `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`.
SHA256: `3BA87606017425986772B0670DAAC06A0746EA95D06E9BE2DADF3DA48822A34C`.

## Ainda falta

- validar a fila MSE em Chrome/Edge e no Electron em duas maquinas Windows;
- medir perda, RTT, primeiro frame e atraso perceptivel em rede local e internet;
- áudio, gamepad e clipboard continuam fora deste transporte.
