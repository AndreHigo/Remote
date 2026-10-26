# Entrega 128 - Rate limit do agente por origem

O limite secundario das rotas `/agent` agora usa somente a origem da requisicao. A chave bearer informada pelo cliente nao cria uma identidade independente de rate limit.

O limite por IP continua aplicado antes do limite por agente, com buckets separados por nome de protecao. Isso evita churn desnecessario de chaves Redis e preserva o teto global por origem.

## Validacao

- `npm run test:security -w services/api` - 22 testes aprovados
- `npm run typecheck -w services/api` - aprovado
- CI deve confirmar a integracao com as demais superficies e o empacotamento Windows.

Isso reduz abuso de rate limit e custo de armazenamento temporario, mas nao substitui firewall, proxy com limites por IP e monitoramento de Redis na VPS.
