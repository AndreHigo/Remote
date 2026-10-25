# Entrega 031 - Gate de audio do modo jogo

## Verificacao local

O FFmpeg encontrado no Windows foi consultado com:

```powershell
ffmpeg -hide_banner -devices
ffmpeg -hide_banner -devices
ffmpeg -hide_banner -list_devices true -f dshow -i dummy
```

Resultado observado:

- o pacote local oferece `gdigrab`, mas nao lista `wasapi` entre os dispositivos;
- o preflight usa `-devices`, que e a forma documentada pelo FFmpeg para listar os dispositivos compilados;
- o DirectShow lista microfones, mas nao fornece captura do audio de saida do desktop nesta maquina.

## Decisao

O modo jogo continua somente com video H.264 ate existir uma build do FFmpeg com captura WASAPI de loopback validada. Nao sera usado um microfone DirectShow como substituto do audio do jogo, porque isso geraria uma funcionalidade enganosa e poderia aumentar o risco de captura indevida.

## Proximo gate

Homologar uma distribuicao do FFmpeg com WASAPI, declarar a captura de audio como opcional e testar o contenedor fragmentado com video H.264 + AAC no cliente nativo e no web. Se a captura de audio falhar, o agente deve continuar oferecendo video sem derrubar a sessao.
