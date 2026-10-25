# Entrega 057: negociacao de MIME H.264

## O que foi feito

- O cliente nativo testa uma lista ordenada de MIME H.264 antes de criar o `SourceBuffer`.
- O cliente web usa a mesma ordem de compatibilidade para iniciar o MSE.
- A sessao continua usando o perfil H.264 produzido pelo host; a mudanca evita rejeitar uma plataforma apenas por uma variante de string MIME que ela nao anuncia.
- Quando nenhum MIME e aceito, a sessao informa erro explicito de decodificacao em vez de falhar silenciosamente.
- O operador ganhou testes automatizados para selecao e ausencia de MIME suportado.

## Limite

Isso melhora compatibilidade de decodificacao, mas nao transforma o modo jogo em suporte universal. Audio, gamepad, anti-cheat, UAC, bloqueio de tela, desempenho e teste entre duas maquinas continuam gates separados.

## Validacao

- `npm test` passou, incluindo os testes do operador.
- `npm run typecheck` passou.
- `npm run build -w apps/web` passou.
- `npm run build -w apps/operator` passou.
