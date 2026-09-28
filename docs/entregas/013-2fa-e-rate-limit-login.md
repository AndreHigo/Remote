# Entrega 013 - 2FA e protecao do login

## Entregue

- Rate limit de login por IP e e-mail normalizado.
- Bloqueio temporario apos cinco falhas dentro de quinze minutos.
- Desbloqueio automatico por expiracao da janela ou login valido.
- 2FA TOTP para contas `owner` e `admin`.
- Segredo TOTP cifrado com AES-256-GCM antes de ser salvo no PostgreSQL.
- Rotas de status, preparacao, ativacao e desativacao do 2FA.
- Auditoria de `auth.2fa.setup`, `auth.2fa.enabled` e `auth.2fa.disabled`.
- Desafio de seis digitos integrado ao login web.
- Segredo e URI `otpauth://` exibidos somente durante a preparacao.

## Validacao executada

- `npm run db:push`
- `npm run typecheck`
- `npm run build`
- `npm run test:security`
- Login normal: HTTP 200.
- Sexta tentativa invalida: HTTP 429.
- Ciclo TOTP completo: preparar, ativar, exigir no login, autenticar e desativar.
- Login e painel validados no navegador local.

## Configuracao de producao

Defina `TOTP_ENCRYPTION_KEY` com um segredo forte e exclusivo, diferente de `JWT_SECRET`. O rate limit atual e local ao processo; em varias replicas, substituir por Redis ou outro armazenamento compartilhado antes do lancamento.

## Ainda falta

- Teste com autenticador real em dispositivo externo.
- Politicas de recuperacao e codigos reserva.
- Rate limit distribuido e observabilidade de bloqueios.
