# Entrega 043 - Rate limit correto no desafio MFA

## Entregue

- o contador de tentativas de login so e limpo quando um token de sessao e emitido;
- o estado intermediario `requiresTwoFactor` nao limpa o contador;
- tentativas com TOTP invalido continuam sujeitas ao limite existente;
- testes unitarios cobrem login incompleto e login concluido.

## Por que importa

Uma senha correta nao deve permitir que o desafio TOTP reinicie a protecao contra tentativas repetidas. O segundo fator permanece parte da autenticacao, e nao uma etapa que libera o contador antes da sessao existir.

## Validacao

```powershell
npm run test:security -w services/api
npm run typecheck -w services/api
```
