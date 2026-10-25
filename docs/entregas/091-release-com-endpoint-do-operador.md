# Entrega 091 - Release com endpoint do operador

## Entregue

- O workflow de release Windows exige os endpoints confiaveis do operador antes de gerar o instalador publico.
- Os valores sao injetados somente no build como configuracao publica de destino; tokens e segredos de sessao continuam fora do pacote.
- O workflow falha cedo quando os dois secrets nao estao configurados juntos.

## Configuracao necessaria no GitHub

- `REMOTO_OPERATOR_API_URL`, por exemplo `https://api.seudominio.com`.
- `REMOTO_OPERATOR_REALTIME_URL`, por exemplo `wss://app.seudominio.com/realtime`.
