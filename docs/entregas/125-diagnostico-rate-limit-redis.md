# 125 - Diagnostico administrativo do rate limit

## Entregue

- O endpoint autenticado `/admin/rate-limit/diagnostics` mostra se a API usa Redis, memoria local ou esta indisponivel.
- A area `Seguranca` do painel exibe essa leitura para owner/admin, com estados de carregamento, fallback local e indisponibilidade.
- Quando Redis esta ativo, a resposta informa `usedMemoryBytes`, `maxMemoryBytes` e `keys`.
- A URL do Redis, os nomes dos buckets e os valores das chaves nunca sao retornados.
- O endpoint fica restrito a owner/admin e responde `503` quando o store distribuido nao pode ser consultado.
- O parser de `INFO memory` possui teste unitario para valores validos e invalidos.

## Limite

Isso cria a leitura operacional necessária para a VPS, mas nao substitui um sistema de alertas persistente. A equipe ainda precisa conectar essa fotografia a monitoramento da infraestrutura e definir limiares de memoria/chaves.
