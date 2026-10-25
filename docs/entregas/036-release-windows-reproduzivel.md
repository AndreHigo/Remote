# Entrega 036 - Release Windows reproduzivel

## Entregue

- workflow manual e por tag em `.github/workflows/release-windows.yml`;
- runner Windows instala dependencias e garante o Inno Setup;
- empacotamento do agente e do operador nativo;
- manifest SHA256 gerado junto com os artefatos;
- artefatos disponibilizados no GitHub Actions;
- tags `v*` podem publicar uma release do GitHub com os instaladores.

## Uso

1. Abra Actions e execute `Remoto Windows Release` para gerar artefatos sem publicar uma release.
2. Para publicar, crie uma tag `v0.1.0` e envie-a ao GitHub.
3. Confira o `release-manifest.txt` antes de distribuir os arquivos.

## Limites

O workflow ainda não assina os binários com Authenticode e não executa homologação entre duas máquinas Windows. A publicação de uma release não transforma o modo jogo em compatível com todos os jogos.
