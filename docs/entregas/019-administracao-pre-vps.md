# Entrega 019 - administracao e pre-VPS

## Entregue

- Cadastro, edicao e exclusao protegida de clientes.
- Criacao, bloqueio, reativacao e redefinicao de senha de usuarios.
- Restricao para que somente o owner crie ou promova outro owner.
- Bloqueio para nunca deixar o workspace sem owner ativo.
- Invalidacao imediata de sessoes antigas ao trocar senha, funcao ou status.
- Controle de solicitacoes de sessao: solicitar, aprovar, negar e encerrar.
- Movimentacao de dispositivo entre clientes.
- Arquivamento e restauracao de dispositivos.
- Exclusao definitiva separada do arquivamento.
- Agente impedido de recriar automaticamente um dispositivo arquivado.
- Auditoria das operacoes administrativas.
- Bootstrap idempotente do primeiro owner da producao.
- Headers adicionais de seguranca no Caddy.
- Migracao `0002_admin_lifecycle` para o estado de arquivamento.

## Validacao executada

```powershell
npm run typecheck
npm run build
npm run test:security
npx prisma migrate deploy --config services/api/prisma.config.ts
```

Tambem foram exercidos na API: criacao e edicao de cliente, ativacao e bloqueio temporario de usuario, solicitacao/aprovacao/encerramento de sessao e arquivamento/restauracao de dispositivo.

`npm audit --audit-level=high` ainda aponta alertas transitivos em `deepmerge-ts` e `mysql2` trazidos pelo Prisma 7. O `npm audit fix --force` propoe downgrade quebrador do Prisma e nao foi aplicado; a atualizacao deve ser revisada com uma versao corrigida do Prisma antes da producao.

## Antes da VPS

1. Copiar `infra/docker/production.env.example` para `infra/docker/production.env` e preencher todos os valores reais.
2. Apontar DNS do painel e do relay RustDesk para o IP publico da VPS.
3. Executar `npm run deploy:preflight -- -Build` na checkout da release.
4. Subir a stack com `docker compose --env-file infra/docker/production.env -f infra/docker/docker-compose.production.yml up -d`.
5. Confirmar `/health`, `/ready`, login do owner e ativacao do 2FA.
6. Testar conexao RustDesk de duas redes externas.
7. Agendar `infra/docker/backup-postgres.ps1` ou equivalente no host e testar restauracao.

O bootstrap de producao cria o owner somente quando o email ainda nao existe; ele nao redefine a senha de um owner existente.
