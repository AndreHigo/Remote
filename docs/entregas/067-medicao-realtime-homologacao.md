# 067 - Medicao reproduzivel do modo jogo

## Entregue

O comando `npm run measure:realtime` abre uma sessao `game` como cliente e gera uma medicao JSON sem incluir tokens ou credenciais. O relatorio registra:

- tempo ate o primeiro segmento fMP4 valido;
- quadros recebidos, FPS observado e bytes recebidos;
- bitrate aproximado do video;
- quantidade de amostras, media e p95 do RTT;
- motivo de encerramento e resultado do primeiro frame.

## Uso

Defina os descritores de uso unico da sessao aprovada e execute:

```powershell
$env:MEASURE_SESSION_ID = "..."
$env:MEASURE_DEVICE_ID = "..."
$env:MEASURE_ACCESS_TOKEN = "..."
$env:MEASURE_REALTIME_URL = "wss://relay.exemplo/realtime"
$env:MEASURE_OUTPUT_PATH = "artifacts/realtime-medicao.json"
npm run measure:realtime
```

`MEASURE_DURATION_SECONDS` aceita de 5 a 300 segundos e usa 30 por padrao. `MEASURE_FIRST_FRAME_TIMEOUT_SECONDS` aceita de 5 a 120 segundos e usa 20 por padrao.

## Interpretacao

O relatorio mede o transporte, nao garante que todo jogo aceite entrada remota. Para liberar uma build, registrar a medicao junto com CPU/GPU, resolucao, encoder, perda, teclado, mouse, audio, gamepad, UAC, bloqueio de tela e compatibilidade do jogo. Uma sessao com primeiro frame valido e RTT baixo ainda pode falhar por anti-cheat ou pela ausencia de uma ponte de gamepad.
