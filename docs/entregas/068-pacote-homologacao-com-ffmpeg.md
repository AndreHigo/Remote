# 068 - Pacote de homologacao com FFmpeg embutido

## Entregue

O empacotador do agente aceita um `ffmpeg.exe` validado no momento do build e o coloca em `ffmpeg\ffmpeg.exe` dentro da instalacao protegida. O instalador Inno Setup inclui esse arquivo automaticamente quando ele existe, eliminando a necessidade de configurar `PATH` na maquina de teste.

O pacote local desta rodada foi gerado com:

```powershell
$ffmpeg = (Get-Command ffmpeg.exe).Source
powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/agent/scripts/build-windows-package.ps1 -FfmpegPath $ffmpeg
```

Saidas:

- `apps/agent/release/RemotoAgent-Setup.exe`;
- `apps/agent/release/RemotoAgent-Windows.zip`;
- `apps/agent/release/RemotoAgent-Windows/ffmpeg/ffmpeg.exe`.

## Regra de distribuicao

O binario nao e versionado no Git nem baixado silenciosamente pelo instalador. Antes de uma release publica, a equipe deve fornecer uma distribuicao FFmpeg validada, guardar os avisos/licencas correspondentes junto aos artefatos e registrar a origem e o hash no manifesto da release. O CI continua gerando o pacote sem FFmpeg quando `REMOTO_BUNDLE_FFMPEG_PATH` nao esta configurado.

## Validacao restante

O pacote embutido remove uma etapa de instalacao, mas ainda precisa ser instalado como Administrador em uma segunda maquina Windows. Depois disso, validar servico, tarefa interativa, inventario, primeiro frame, teclado, mouse e atualizacao sobre uma instalacao existente.
