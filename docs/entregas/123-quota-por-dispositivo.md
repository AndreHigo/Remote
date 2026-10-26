# 123 - Quota de agente por dispositivo

## Entregue

- As rotas autenticadas do agente agora possuem um segundo limite compartilhado por agente e dispositivo.
- O limite e de 120 requisicoes por janela de 60 segundos, com os cabecalhos `RateLimit-AgentDevice-*` e `Retry-After` quando excedido.
- O bucket cobre heartbeat, status, inventario, consulta de comandos e consulta de sessoes remotas.
- O cadastro inicial e o envio de resultado de comando continuam protegidos pelo limite global do grupo `/agent`, sem depender de um ID de dispositivo na URL.
- Em producao, o bucket segue o mesmo Redis distribuido e fail-closed dos demais limites.

## Motivo

O limite global por IP e por chave impedia abuso amplo, mas nao isolava a frequencia de um dispositivo especifico. Agora um agente que opere varios computadores nao consegue consumir a quota de um dispositivo para afetar os demais, e uma rotina descontrolada fica limitada antes de pressionar banco e relay.

## Validacao restante

- Testar em duas maquinas reais com heartbeat, comandos e sessoes simultaneas.
- Observar memoria e quantidade de chaves do Redis na VPS e ajustar `120/min` com dados reais.
