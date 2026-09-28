# Entrega 003: autenticacao, usuarios e papeis

## Entregue

- Modelo `User` no Prisma.
- Enum `UserRole` com `OWNER`, `ADMIN`, `TECHNICIAN` e `VIEWER`.
- Hash de senha com `crypto.scrypt`.
- Token assinado com HMAC para o MVP.
- `POST /auth/login`.
- `GET /auth/me`.
- Middleware de autenticacao por `Authorization: Bearer`.
- Rotas principais protegidas.
- Restricao por papel para cadastro de dispositivo e heartbeat.
- Solicitacao de sessao remota usando o usuario autenticado, sem `Tecnico Demo` fixo.
- Seed com 3 usuarios locais:
  - `admin@remoto.local / remoto123`;
  - `tecnico@remoto.local / tecnico123`;
  - `viewer@remoto.local / viewer123`.
- Tela de login no painel web.
- Botao de sair e identificacao do usuario logado no topo.

## Validacao executada

```bash
npx prisma validate
npm run typecheck
npm run build
npm run db:push
npm run db:seed
npm audit
npm run dev
```

Resultado:

- `npx prisma validate`: schema valido.
- `npm run typecheck`: API e web sem erros de TypeScript.
- `npm run build`: API e painel web compilados.
- `npm run db:push`: schema aplicado no Postgres.
- `npm run db:seed`: usuarios, clientes e dispositivos recriados.
- `npm audit`: 0 vulnerabilidades.
- `GET http://localhost:4100/summary` sem token: HTTP 401.
- `GET http://localhost:4100/summary` com token invalido: HTTP 401.
- `POST http://localhost:4100/auth/login`: login valido para `admin@remoto.local`.
- `GET http://localhost:4100/auth/me` com token: HTTP 200.
- `GET http://localhost:4100/summary` com token: HTTP 200.
- `POST http://localhost:4100/remote-sessions` com token: HTTP 201.
- `POST http://localhost:4100/devices/dev_financeiro_01/heartbeat` com usuario `VIEWER`: HTTP 403.
- `GET http://localhost:5173`: HTTP 200.

## Falta

- Refresh token e revogacao de sessao.
- 2FA.
- Politica de senha.
- Recuperacao de senha.
- Convite de usuarios.
- Permissoes por cliente/grupo de dispositivo.
- Separacao formal de organizacao/tenant.
- Autenticacao propria para agente.
- Testes automatizados de auth.

## Proximo passo recomendado

Criar permissoes por cliente/grupo e preparar o modelo de organizacao. Depois disso, criar um agente CLI simulado com chave propria para registrar dispositivo e enviar heartbeat sem depender de usuario humano.
