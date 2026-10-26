# Entrega 103 - Edicao de funcao de usuario

## Entregue

- Owner e admin agora conseguem alterar a funcao de um usuario pelo painel.
- A tela confirma a operacao antes de enviar a mudanca.
- O servidor continua decidindo se a troca e permitida, incluindo a regra de owner e ultimo owner ativo.
- A alteracao revoga as sessoes remotas do usuario quando a funcao muda.
- O usuario logado nao pode alterar a propria funcao pela lista.

## Limites preservados

Nao foi criada uma permissao nova nem uma rota paralela. O painel usa `PATCH /users/:id`, a mesma fronteira administrativa ja protegida pela API e auditada no backend.
