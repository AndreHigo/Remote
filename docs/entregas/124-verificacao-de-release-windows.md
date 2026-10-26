# 124 - Verificacao da release Windows

## Entregue

- A release Windows passou a publicar `release-manifest.json` com versao, caminhos relativos, SHA-256 e indicacao de assinatura Authenticode.
- O script `scripts/verify-windows-release.ps1` verifica a existencia dos artefatos, recalcula os hashes, confere a versao do pacote do agente e pode exigir assinatura valida nos executaveis.
- O workflow de tag executa o verificador depois da assinatura e antes do upload/publicacao.
- O workflow de homologacao continua permitindo artefatos sem assinatura, pois eles nao sao releases publicas.

## Limite

O verificador prova a integridade e a assinatura do artefato quando o certificado real estiver configurado. Ele nao substitui a compra/configuracao do certificado Authenticode nem a homologacao funcional em duas maquinas Windows.
