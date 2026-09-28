# Entrega 014 - hardening e CI

## Entregue

- Headers de seguranca na API: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.
- Remocao da assinatura `X-Powered-By` do Express.
- Limite de payload JSON de 1 MB.
- Validacao obrigatoria de `JWT_SECRET` e `TOTP_ENCRYPTION_KEY` em producao.
- Configuracao explicita de `TRUST_PROXY` para preservar a leitura segura do IP do rate limit.
- Endpoint `/ready` com verificacao real de conexao ao PostgreSQL.
- Rate limit por IP para o grupo de endpoints do agente.
- Sessao web migrada para cookie `HttpOnly`, com logout explicito e fallback Bearer para clientes tecnicos.
- Pipeline GitHub Actions para testes, typecheck, build e validacao dos dois Compose.
- Auditoria npm registrada no CI sem esconder o resultado.

## Validacao local

- `npm run test:security`
- `npm run typecheck`
- `npm run build`
- `GET /health`
- `GET /ready`
- `docker compose ... config` para Postgres e RustDesk.

## Ainda falta

- Corrigir a cadeia vulneravel do Prisma CLI em uma atualizacao compatível, sem downgrade forcado.
- Publicar o workflow no GitHub e observar a primeira execucao.
- Adicionar scanning de imagem, secret scanning e deploy protegido por ambiente.
