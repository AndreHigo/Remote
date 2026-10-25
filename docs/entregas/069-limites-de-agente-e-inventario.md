# 069 - Limites por agente e retencao de inventario

## Entregue

- O limite HTTP do grupo `/agent` agora usa o hash SHA-256 da chave do agente quando ela existe, em vez de depender somente do IP de origem. Revezar IPs nao cria um novo bucket para a mesma credencial.
- Quando `REDIS_URL` esta configurada, o contador usa um script atomico no Redis e funciona entre replicas da API. Em producao, a API e o preflight exigem essa configuracao.
- Requisicoes sem chave continuam limitadas por IP para proteger o endpoint antes da autenticacao.
- O banco retém somente os 50 inventarios mais recentes por dispositivo; snapshots antigos sao removidos na mesma transacao da coleta.

Esses controles reduzem abuso de uma chave comprometida e crescimento indefinido do historico sem alterar o cadastro, heartbeat ou inventario exibido no painel.

## Limite restante

Sem `REDIS_URL`, ambientes locais continuam usando o fallback em memoria. Ainda faltam quotas de frequencia por dispositivo e validar a recuperacao de conta em ambiente real.
