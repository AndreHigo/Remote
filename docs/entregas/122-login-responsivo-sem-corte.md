# Entrega 122 - Login responsivo sem corte

O login do painel agora empilha a marca e o formulário quando a janela tem menos de 900px de largura. Antes, o breakpoint de duas colunas só entrava abaixo de 760px e podia deixar o formulário cortado em janelas compactas, como a captura de homologacao em 800px.

Tambem foi aplicado um limite de largura baseado no viewport (`calc(100vw - 48px)`), preservando margem lateral para a pagina nao criar overflow horizontal.

## Validacao

- `npm run build -w apps/web` passou;
- typecheck do painel passou antes da publicacao;
- a verificacao visual automatizada nao foi executada porque o ambiente CUA retornou erro de inicializacao do kernel, sem alterar o codigo do projeto.
