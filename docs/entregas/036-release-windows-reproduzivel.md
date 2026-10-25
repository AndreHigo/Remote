# Entrega 036 - Release Windows reproduzivel

## Entregue

- workflow manual e por tag em `.github/workflows/release-windows.yml`;
- runner Windows instala dependencias e garante o Inno Setup;
- empacotamento do agente e do operador nativo;
- manifest SHA256 gerado junto com os artefatos;
- artefatos disponibilizados no GitHub Actions;
- tags `v*` podem publicar uma release do GitHub com os instaladores; a versao sem o prefixo `v` e propagada para o instalador do agente e para o artefato do operador.

## Uso

1. Abra Actions e execute `Remoto Windows Release` para gerar artefatos sem publicar uma release.
2. Para publicar, crie uma tag `v0.1.0` e envie-a ao GitHub.
3. Confira o `release-manifest.txt` antes de distribuir os arquivos.

## Limites

Execuções manuais geram artefatos de homologação sem assinatura. Publicações por tag `v*` exigem `WINDOWS_CODESIGN_PFX_B64` e `WINDOWS_CODESIGN_PFX_PASSWORD`, executam testes, typecheck, build e auditoria, propagam a versão da tag por `REMOTO_RELEASE_VERSION`, assinam os executáveis com Authenticode e só então publicam a release. O pacote do agente aceita `REMOTO_AGENT_OUTPUT_ROOT` para uma saída isolada de homologação. Isso ainda não substitui homologação entre duas máquinas Windows nem transforma o modo jogo em compatível com todos os jogos.
