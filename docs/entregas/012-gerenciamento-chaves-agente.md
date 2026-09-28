# Entrega 012 - Gerenciamento de chaves do agente

## Entregue

- admin e owner podem listar chaves de agente sem expor o segredo;
- criação de chave por cliente pelo painel;
- segredo exibido somente na resposta de criação;
- botão para copiar o segredo uma única vez;
- revogação de chave pelo painel;
- registro de criação e revogação na auditoria;
- chaves revogadas deixam de autenticar imediatamente;
- viewer e technician nao recebem permissao para administrar chaves.

## Validacao pratica

- login admin realizado;
- chave temporaria criada para `cus_pequizeiro`;
- segredo gerado com 35 caracteres;
- chave listada sem retornar `keyHash` ou segredo;
- chave revogada com sucesso;
- solicitacao de sessao retornou URI `rustdesk://connection/new/...`;
- viewer recebeu `403` ao tentar solicitar sessao.

## Dependencias

`npm audit fix` sem `--force` corrigiu `qs` e `fast-uri` e atualizou o Prisma dentro da faixa 7.x. Permanecem alertas na cadeia de ferramentas do Prisma CLI (`deepmerge-ts` e `mysql2`), cuja correção sugerida pelo npm exige downgrade major para Prisma 6. O downgrade nao foi aplicado; esse upgrade deve ser tratado como uma tarefa coordenada de dependencias antes de produção.

## Ainda falta

- 2FA para contas administrativas;
- expiracao opcional de chaves;
- rotacao assistida sem interromper agentes ativos;
- tela de usuarios, grupos e permissoes finas;
- testes automatizados de API para cada papel.
