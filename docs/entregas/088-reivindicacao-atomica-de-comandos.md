# Entrega 088 - Reivindicacao atomica de comandos

## Entregue

- A fila agora muda `PENDING` para `RUNNING` somente quando a transicao atomica vence.
- Processos concorrentes nao executam o mesmo comando duas vezes.
- O resultado so pode finalizar um comando que esteja em `RUNNING`.
- A protecao vale para agentes duplicados, reinicios e chamadas atrasadas da mesma instalacao.

## Limite

O agente continua fazendo polling; a garantia de exclusao da fila depende da persistencia transacional do PostgreSQL em producao.
