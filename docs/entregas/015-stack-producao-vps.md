# Entrega 015 - stack de producao para VPS

## Entregue

- Migration inicial versionada em `services/api/prisma/migrations/0001_init`.
- Dockerfile multi-stage da API com runtime separado das dependencias de build.
- Dockerfile do painel com Nginx e fallback de SPA.
- Caddy como proxy HTTPS para `/api` e painel web.
- Em `NODE_ENV=production`, o endpoint de login nao devolve o JWT ao JavaScript; a sessao usa cookie `HttpOnly`.
- Compose de producao com PostgreSQL privado, migration, API, web e RustDesk OSS.
- Healthchecks de PostgreSQL e API.
- Arquivo `production.env.example` sem segredos reais.
- O instalador do agente é montado de forma somente leitura em `/opt/remoto/releases` e servido pela API após ser colocado em `infra/docker/release/`.

## Validacao obrigatoria antes de subir

- Trocar todos os valores de `production.env`.
- Criar DNS para o painel e para o relay RustDesk.
- Abrir somente as portas documentadas.
- Fazer backup externo do volume PostgreSQL.
- Copiar o instalador Windows assinado para `infra/docker/release/RemotoAgent-Setup.exe` antes do preflight.
- Instalar RustDesk nos dois computadores e configurar a chave publica do servidor.
- Rodar teste de tela, teclado, mouse, reconexao e encerramento em duas redes distintas.

## Comando

```powershell
Copy-Item infra/docker/production.env.example infra/docker/production.env
docker compose --env-file infra/docker/production.env -f infra/docker/docker-compose.production.yml up -d --build
```

O deploy nao deve ser considerado aprovado apenas porque os containers iniciaram; o teste E2E de acesso remoto ainda e uma evidencia externa necessaria.
