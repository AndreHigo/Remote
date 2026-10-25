# 073 - Revogacao de sessoes ao alterar o 2FA

## Entregue

- Ativar ou desativar o TOTP incrementa atomicamente `User.sessionVersion` junto com a mudanca de protecao.
- Tokens emitidos antes da alteracao deixam de passar pelo middleware de autenticacao imediatamente.
- A API informa `sessionRevoked: true` nas respostas de ativacao e desativacao.
- O painel limpa a sessao local e mostra uma mensagem clara para o operador entrar novamente.

## Validacao

- Teste unitario da mutacao de 2FA: `npm run test:security`.
- `npm run typecheck` passou para API, web, desktop-control, agente e realtime.
- `npm run build` passou para todos os pacotes.

## Observacao operacional

Esse logout apos a alteracao e intencional: ele evita que o navegador continue operando com uma sessao emitida antes da nova politica de autenticacao. Depois do novo login, o usuario precisa informar o codigo TOTP quando o 2FA estiver ativo.
