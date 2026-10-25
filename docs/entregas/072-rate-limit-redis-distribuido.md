# 072 - Rate limit distribuido com Redis

## Entregue

- A API usa um contador atomico com `INCR` e `PEXPIRE` no Redis quando `REDIS_URL` esta configurada.
- A chave persistida e um hash SHA-256 do nome do limite e da identidade, sem gravar IP, email ou chave de agente em texto.
- Em producao, `REDIS_URL` e obrigatoria no processo da API, no Compose e no preflight.
- O endpoint `/ready` verifica PostgreSQL e Redis; o container fica fora do pool saudavel se o rate limit distribuido nao estiver acessivel.
- Se Redis nao estiver configurado, o desenvolvimento local continua usando o fallback em memoria. Se estiver configurado e indisponivel, a producao falha fechado com `rate_limit_unavailable`.

## Validacao

- Teste unitario do fallback local: `npm run test:security`.
- Teste real com Redis 7 em container isolado: tres chamadas no mesmo bucket produziram duas passagens e uma resposta `429`.
- `npm run typecheck -w services/api` e `npm run build -w services/api` passaram.
- CI valida o Compose de producao com `REDIS_URL` preenchida.

## Limites

Ainda faltam quotas especificas por dispositivo e monitoramento de memoria/chaves no Redis. O Redis deve ser fornecido pela VPS ou por um servico gerenciado, com senha e preferencialmente `rediss://` fora da rede privada.
