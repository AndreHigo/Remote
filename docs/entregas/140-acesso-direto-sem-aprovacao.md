# Entrega 140 - Acesso direto para owner e admin

## O que foi entregue

- `owner` e `admin` deixam de aguardar aprovacao manual ao abrir um computador cadastrado.
- A API cria a sessao, executa a mesma aprovacao interna, emite o token de uso unico e devolve a conexao pronta.
- O painel consome o token automaticamente e entra no suporte ou modo jogo no navegador.
- A abertura continua protegida por workspace, limite de sessoes, validacao do modo jogo e auditoria de solicitacao, aprovacao e consumo.
- `technician` continua no fluxo de solicitacao para aprovacao administrativa.

## Como usar

1. Entre no painel com uma conta owner ou admin.
2. Abra **Dispositivos** e clique em **Abrir sessao remota**.
3. Informe o motivo e clique em **Abrir acesso**.
4. A sessao deve abrir automaticamente no navegador; nao existe mais uma etapa de aprovacao para esses perfis.

## Validacao

- `npm run typecheck` nos workspaces API e Web.
- `npm run build -w services/api`.
- `npm run build -w apps/web`.
- `npm test`: 98 testes aprovados.

## Ainda falta antes da VPS

- Testar esse fluxo com API e relay em HTTPS/WSS fora da maquina local.
- Confirmar a politica comercial desejada para tecnicos: aprovacao obrigatoria ou acesso direto por cliente.
- Atualizar o agente instalado nos computadores que ainda estejam em versao antiga.
