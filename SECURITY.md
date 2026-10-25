# Politica de seguranca

## Escopo

O Remoto controla dispositivos Windows e transporta video e entrada de usuario. Esta politica cobre a API, o painel web, o agente Windows, o relay realtime, o instalador e a infraestrutura Docker/VPS.

## Reportar vulnerabilidades

Nao publique tokens, chaves de agente, credenciais ou provas de conceito em issues publicas. Para um relato responsavel, use um canal privado do repositorio ou o GitHub Security Advisories quando habilitado. Inclua versao/commit, impacto, pre-condicoes e passos de reproducao sem dados reais.

## Invariantes de seguranca

- Toda sessao remota nasce de uma solicitacao com motivo e aprovacao administrativa.
- Tokens desktop sao assinados, curtos, armazenados como hash e consumidos uma unica vez pelo endpoint do operador; reconexoes do canal permanecem limitadas pela expiracao da sessao.
- O relay exige segredo interno para consultar a API e valida `sessionId`, dispositivo, modo, papel e expiracao na entrada e durante a revalidacao da sala.
- Uma sala aceita no maximo um `host` e um `client`; frames so vao de host para client e entrada tipada so vai de client para host.
- O agente so acessa dispositivos do cliente associado a sua chave.
- Entrada Windows aceita somente eventos tipados; nao existe avaliacao de comando arbitrario.
- Modo jogo permanece desligado por padrao e exige `REALTIME_INTERNAL_SECRET` antes de ser anunciado como disponivel.

## Requisitos de producao

- Usar HTTPS/WSS com dominio publico e certificados validos.
- Gerar `JWT_SECRET`, `DESKTOP_SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`, `REALTIME_INTERNAL_SECRET`, `REDIS_URL` e senha do banco aleatorios, longos e fora do Git.
- Manter `REALTIME_ALLOWED_ORIGINS` restrito ao dominio do painel.
- Rodar `infra/docker/preflight-production.ps1` antes do deploy.
- Manter portas do PostgreSQL fechadas e expor somente os endpoints necessarios.
- Ativar 2FA para administradores e tecnicos antes de habilitar acesso operacional.
- Fazer backup e testar restauracao do PostgreSQL.
- Usar Redis compartilhado para o rate limit em qualquer deploy com mais de uma replica da API.
- Assinar o instalador Windows antes de distribuicao publica; o binario atual e uma release de teste.

## Limites conhecidos do MVP

- O schema agora representa explicitamente o limite de um workspace e as consultas administrativas aplicam esse escopo. O MVP continua workspace-wide dentro de cada workspace; memberships por cliente e gestao de varias empresas ainda nao estao expostos.
- O teste entre duas maquinas e a validacao de internet ainda sao obrigatorios antes de producao.
- O cliente nativo visual e gamepad ainda exigem homologacao; audio do sistema foi implementado como caminho opcional por WASAPI/FFmpeg, mas ainda depende de build e teste real no Windows.
- A auditoria estrutural completa deve ser executada em ambiente com Python e seus artefatos revisados.
- RustDesk e um componente terceiro separado do relay de jogo; sua licenca e configuracao devem ser revisadas antes de comercializacao.
