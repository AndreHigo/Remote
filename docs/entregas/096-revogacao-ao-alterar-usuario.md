# Entrega 096 - Revogacao imediata ao alterar usuario

## Entregue

- Alterar o papel ou desativar um usuario continua encerrando as sessoes remotas no banco.
- A API agora envia os IDs dessas sessoes para o relay e fecha as conexoes realtime imediatamente.
- A resposta HTTP continua expondo apenas o usuario atualizado, sem vazar IDs internos de sessao.

## Motivo

Sem o fechamento no relay, uma conexao ja estabelecida poderia permanecer aberta ate o proximo evento ou timeout, mesmo depois de uma mudanca administrativa que deveria retirar o acesso.

## Validacao

- Typecheck e testes de seguranca da API.
- Smoke local de API, agente, captura, sessao game e relay.

