# Entrega 090 - Endpoint confiavel do operador

## Entregue

- O operador local continua aceitando endpoints do descritor apenas em desenvolvimento.
- O operador empacotado exige endpoints fixados no build ou em configuracao de deployment.
- Um descritor alterado com API ou relay diferente do deployment e recusado antes de enviar o bearer.
- O empacotamento grava somente os endpoints publicos em `build/operator-config.json`; nenhum token e incluido nessa configuracao.

## Como empacotar

Defina `REMOTO_OPERATOR_API_URL` e `REMOTO_OPERATOR_REALTIME_URL` juntos antes de executar `npm run operator:package:windows`. O CI de qualidade continua validando o codigo, enquanto a release publica deve fornecer os endpoints reais do deployment.
