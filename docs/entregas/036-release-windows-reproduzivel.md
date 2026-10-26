# Entrega 036 - Release Windows reproduzivel

## Entregue

- workflow manual e por tag em `.github/workflows/release-windows.yml`;
- runner Windows instala dependencias e garante o Inno Setup;
- empacotamento do agente e do operador nativo;
- manifesto JSON de release gerado junto com os artefatos, com versao, SHA256 e indicacao dos executaveis que exigem Authenticode;
- verificador reaproveitavel que confere arquivos, hashes, versao do pacote do agente e assinaturas em releases por tag;
- manifesto `RemotoAgent-package.json` dentro do pacote do agente, com versao, hash/origem do FFmpeg e limites declarados do modo jogo;
- artefatos disponibilizados no GitHub Actions;
- tags `v*` podem publicar uma release do GitHub com os instaladores; a versao sem o prefixo `v` e propagada para o instalador do agente, para o inventario reportado pelo agente e para o artefato do operador.

## Uso

1. Abra Actions e execute `Remoto Windows Release` para gerar artefatos sem publicar uma release.
2. Para publicar, crie uma tag `v0.1.0` e envie-a ao GitHub.
3. Confira o `release-manifest.json`; o workflow de tag executa `scripts/verify-windows-release.ps1` com assinatura obrigatoria antes de publicar.

## Limites

Execuções manuais geram artefatos de homologação sem assinatura. Publicações por tag `v*` exigem `WINDOWS_CODESIGN_PFX_B64` e `WINDOWS_CODESIGN_PFX_PASSWORD`, `REMOTO_FFMPEG_URL`, `REMOTO_FFMPEG_SHA256` e `REMOTO_FFMPEG_LICENSE_URL`, executam testes, typecheck, build e auditoria, propagam a versão da tag por `REMOTO_RELEASE_VERSION`, conferem o FFmpeg, levam os avisos de terceiros para o instalador, assinam os executáveis com Authenticode, validam o manifesto e só então publicam a release. `REMOTO_FFMPEG_SOURCE_URL` e opcional e registra a origem no manifesto. O pacote do agente aceita `REMOTO_AGENT_OUTPUT_ROOT` para uma saída isolada de homologação. Isso ainda não substitui homologação entre duas máquinas Windows nem transforma o modo jogo em compatível com todos os jogos.
