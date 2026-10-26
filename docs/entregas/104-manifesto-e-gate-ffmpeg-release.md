# Entrega 104 - Manifesto e gate de FFmpeg da release

O empacotador do agente agora grava `RemotoAgent-package.json` dentro do pacote. O manifesto registra a versao, se o `ffmpeg.exe` foi embutido, o SHA-256 e a primeira linha de versao retornada pelo binario. Tambem declara os limites conhecidos do modo jogo: fallback por CPU, audio de sistema opcional e ausencia de gamepad virtual XInput/DirectInput.

O build de homologacao continua aceitando um pacote sem FFmpeg, para validar cadastro, inventario, suporte e fluxo administrativo. Uma release criada a partir de tag passa a exigir `REMOTO_REQUIRE_BUNDLED_FFMPEG=true` e um FFmpeg baixado de uma origem validada; sem isso o job falha antes de produzir um instalador que pareca pronto para jogos.

Para gerar uma build local de homologacao com FFmpeg:

```powershell
$ffmpeg = (Get-Command ffmpeg.exe).Source
powershell.exe -NoProfile -ExecutionPolicy Bypass -File apps/agent/scripts/build-windows-package.ps1 -FfmpegPath $ffmpeg
```

O workflow de release usa as variaveis de repositorio `REMOTO_FFMPEG_URL` e `REMOTO_FFMPEG_SHA256` para baixar o binario no runner, conferir o hash e so entao preencher `REMOTO_BUNDLE_FFMPEG_PATH` durante o build. O executavel nao e versionado no Git e nao e baixado silenciosamente pelo instalador. A equipe ainda precisa registrar origem, licenca e hash antes de publicar uma release com modo jogo.

Este gate nao prova desempenho, audio WASAPI, compatibilidade universal, anti-cheat ou gamepad virtual. Esses pontos continuam dependendo de homologacao em duas maquinas Windows reais.
