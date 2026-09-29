# Entrega 018 - Fluxo inicial de cadastro de computador

## Entregue

- Botao `Adicionar computador` no workspace de dispositivos.
- Selecao do cliente antes da criacao da credencial.
- Nome da instalacao para identificar a chave.
- Criacao de chave de agente pelo endpoint autenticado existente.
- Exibicao unica do segredo com acao de copia.
- Instrucoes honestas para o agente de desenvolvimento atual.
- Correcao do carregamento de clientes e chaves usando sessao por cookie.

## Limite atual

O agente ainda e um CLI Node/TypeScript. O fluxo visual prepara a inscricao, mas ainda nao entrega um instalador Windows para o operador final.

## Proximo passo

Gerar um pacote Windows instalavel que receba a chave, instale o agente como servico e inicie o registro automaticamente. O criterio de aceite sera instalar em uma segunda maquina, ve-la online no painel e abrir uma sessao RustDesk.

## Validacao desta entrega

- `npm run typecheck`
- `npm run build`
- Login com cookie e carregamento de clientes no assistente.
- Abertura do assistente e geracao de chave em navegador.
- Revogacao da chave usada no teste.
