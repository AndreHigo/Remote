# Entrega 044 - Escolha do navegador ou cliente nativo

## Problema corrigido

Ao aprovar uma sessão de jogo, o painel web consumia imediatamente o token de uso único do desktop. Isso fazia o download do descritor nativo carregar uma credencial já consumida, e o `Remoto Operator` não conseguia iniciar a sessão.

## Comportamento atual

1. A aprovação cria a sessão e mantém o token reservado, sem consumi-lo.
2. O operador escolhe `Abrir no navegador` ou `Cliente nativo`.
3. O navegador consome o token somente ao iniciar o relay web.
4. O cliente nativo recebe o descritor ainda válido e faz o consumo ao iniciar.
5. Depois de baixar o descritor, o painel bloqueia a segunda opção para evitar duas tentativas com o mesmo token.

## Validação

- `npm run typecheck -w apps/web`
- `npm run build -w apps/web`
- `npm test`

O teste real do cliente nativo ainda precisa ser feito em duas máquinas, porque depende de rede, permissões do Windows, captura de tela, entrada e encoder disponíveis no computador remoto.
