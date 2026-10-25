# 069 - Limites por agente e retencao de inventario

## Entregue

- O limite HTTP do grupo `/agent` agora usa o hash SHA-256 da chave do agente quando ela existe, em vez de depender somente do IP de origem. Revezar IPs nao cria um novo bucket para a mesma credencial.
- Requisicoes sem chave continuam limitadas por IP para proteger o endpoint antes da autenticacao.
- O banco retém somente os 50 inventarios mais recentes por dispositivo; snapshots antigos sao removidos na mesma transacao da coleta.

Esses controles reduzem abuso de uma chave comprometida e crescimento indefinido do historico sem alterar o cadastro, heartbeat ou inventario exibido no painel.

## Limite restante

O rate limit continua em memoria por instancia. Em uma VPS com varias replicas, a proxima etapa e usar um store compartilhado e adicionar quotas de frequencia por dispositivo. A politica de MFA obrigatorio para tecnicos e administradores tambem precisa ser aplicada no fluxo de onboarding antes da liberacao publica.
