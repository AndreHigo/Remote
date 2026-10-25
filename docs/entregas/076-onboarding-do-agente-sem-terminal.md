# Entrega 076 - Onboarding do agente sem terminal

## Entregue

- O modal **Adicionar computador** agora apresenta o download do instalador Windows como caminho principal.
- O comando `npm run agent:register` foi movido para uma seção de instalação avançada, voltada apenas para desenvolvimento.
- O endereço do instalador pode ser configurado com `VITE_AGENT_INSTALLER_URL`.
- O padrão aponta para o artefato `RemotoAgent-Setup.exe` da release mais recente do GitHub.
- A tela de login passa a usar uma composição compacta antes de larguras menores, evitando o painel dividido cortado em janelas intermediárias.

## Validação

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run validate:release -- -SkipAudit`

Todos passaram. O preflight ainda registra o aviso conhecido de que o FFmpeg local não oferece WASAPI; nesse host o modo jogo fica video-only até instalar uma build validada com áudio de sistema.

## Próximo gate

O download aponta para a release mais recente. Antes da publicação pública, é necessário criar uma release assinada com o instalador e confirmar o link no ambiente hospedado.
