# Entrega 076 - Onboarding do agente sem terminal

## Entregue

- O modal **Adicionar computador** agora apresenta o download do instalador Windows como caminho principal.
- O comando `npm run agent:register` foi movido para uma seção de instalação avançada, voltada apenas para desenvolvimento.
- O endereço do instalador pode ser configurado com `VITE_AGENT_INSTALLER_URL`.
- O padrão aponta para `/api/downloads/agent`, servido pela própria API quando `REMOTO_AGENT_INSTALLER_PATH` está configurado.
- A tela de login passa a usar uma composição compacta antes de larguras menores, evitando o painel dividido cortado em janelas intermediárias.

## Validação

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run validate:release -- -SkipAudit`

Todos passaram. O preflight ainda registra o aviso conhecido de que o FFmpeg local não oferece WASAPI; nesse host o modo jogo fica video-only até instalar uma build validada com áudio de sistema.

## Próximo gate

Na VPS, publicar o instalador assinado fora do checkout, configurar `REMOTO_AGENT_INSTALLER_PATH`, reiniciar a API e confirmar `agentInstaller: "available"` em `/health`. Uma CDN ou GitHub Release também pode ser usada definindo `VITE_AGENT_INSTALLER_URL` durante o build do painel.
