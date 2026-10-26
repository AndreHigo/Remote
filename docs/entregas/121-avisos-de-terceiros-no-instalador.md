# Entrega 121 - Avisos de terceiros no instalador

O empacotamento Windows do agente agora preserva a rastreabilidade do FFmpeg distribuido:

- procura automaticamente `LICENSE` e `README.txt` na pasta do binario e na pasta pai;
- aceita caminhos explicitos por `-FfmpegLicensePath` e `-FfmpegReadmePath`;
- inclui os arquivos como `ffmpeg/FFMPEG-LICENSE.txt` e `ffmpeg/FFMPEG-README.txt`;
- gera `THIRD-PARTY-NOTICES.txt` com versao, SHA-256, licenca e origem registrados;
- publica esses metadados em `RemotoAgent-package.json`;
- exige `REMOTO_FFMPEG_LICENSE_URL` quando uma release com tag baixa o FFmpeg diretamente.

O instalador Inno Setup inclui os avisos junto com o binario. O pacote local homologado foi gerado com FFmpeg 8.1.2-full_build-www.gyan.dev, identificado como GPL v3 pelo README do fornecedor, e o manifesto registra o hash do executavel. A origem e a licenca ainda devem ser revisadas pelo responsavel pela distribuicao antes de uma release comercial.

## Validacao

- `npm run package:windows -w apps/agent -- -FfmpegPath ... -RequireBundledFfmpeg`
- `npm run validate:release -SkipBuild`
- ZIP conferido com os avisos e o binario presentes;
- `npm audit`: zero vulnerabilidades.

O pacote continua sem assinatura Authenticode nesta homologacao. Assinatura, teste em duas maquinas e publicacao na VPS permanecem gates externos.
