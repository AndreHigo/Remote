# Entrega 028 - Checklist antes da VPS

## Estado validado

- commit de referência: branch `main` no repositorio remoto;
- `npm test`: 31 testes passando;
- `npm run typecheck`: API, web, desktop-control, agent e realtime sem erros;
- `npm run build`: build completo validado no estado atual do workspace;
- `npm audit --audit-level=high`: 0 vulnerabilidades;
- `docker compose config`: configuracao local valida, com imagens de producao fixadas por digest;
- relay revalida salas a cada 10 segundos e fecha sessoes revogadas;
- logout, desativacao, reset de senha, arquivamento e fechamento nativo revogam sessoes;
- agente arquivado nao aceita heartbeat, inventario ou comandos;
- instalador do operador gerado localmente:
  `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`;
- SHA256 do instalador: `3BA87606017425986772B0670DAAC06A0746EA95D06E9BE2DADF3DA48822A34C`.
- instalador do agente Windows gerado localmente:
  `apps/agent/release/RemotoAgent-Setup.exe`;
- SHA256 atual do instalador do agente: `DA705B9562BA85B9B4DA9EB28A737DAD437B84A9B61A108D357A7475B9DCD254`;
- o instalador do agente encerra o serviço, o host do serviço e o processo interativo antes da atualização para evitar arquivo bloqueado.
- o operador nativo agora exibe RTT e tenta reconectar após queda transitória, conforme `docs/entregas/030-reconexao-e-rtt-operador-nativo.md`.
- o transporte do host preserva segmentos fMP4 completos antes de enviá-los ao relay, conforme `docs/entregas/032-segmentacao-fmp4-baixa-latencia.md`.
- o CI também executa os testes do agente e valida a sintaxe dos scripts do operador nativo, conforme `docs/entregas/033-ci-agente-e-operador.md`.
- o CI validou o empacotamento Windows do Agent e do Operator no run `40209686463`, conforme `docs/entregas/038-ci-empacotamento-windows.md`.
- a revisão de segurança do diff de descoberta/inicialização do RustDesk terminou com cobertura completa e zero achados reportáveis.
- `npm run validate:release`: testes, typecheck, build, auditoria, sintaxe, hashes e gate de áudio executados no workspace local.
- o bridge de entrada libera teclas e botões mantidos quando a sessão encerra, conforme `docs/entregas/039-liberacao-de-entrada.md`.

## Fechamento antes da producao

1. O limite de instalacao agora esta explicito no schema e na migracao `0006_workspace_scope`: usuarios, clientes e todas as operacoes administrativas sao filtrados pelo workspace autenticado. O MVP continua workspace-wide dentro de cada workspace; memberships por cliente e papeis por cliente ficam para uma etapa posterior, caso o produto precise desse nivel de delegacao.
2. Assinar o instalador e os binarios Windows com Authenticode e publicar checksums assinados. As imagens Docker agora estao fixadas por digest e as ferramentas do pacote do agente ficam declaradas no lockfile; o script usa `npx --no-install` e falha se elas nao estiverem disponiveis localmente.
3. Executar o teste de duas maquinas Windows seguindo `docs/entregas/029-runbook-homologacao-jogo.md`, primeiro na rede local e depois pela internet com HTTPS/WSS, medindo FPS, RTT, perda, CPU/GPU, UAC, troca de sessao, bloqueio de tela, gamepad e compatibilidade por jogo.
4. Configurar na VPS os segredos reais, dominio, TLS, banco, backup, firewall e observabilidade. O preflight de producao deve falhar se algum segredo obrigatorio estiver ausente.

## Decisao

O sistema esta pronto para homologacao controlada e para preparar a VPS. Os bloqueios para uma release publica sao a assinatura dos binarios, o teste real entre duas maquinas e a configuracao validada da VPS; a migracao `0006_workspace_scope` ainda deve ser aplicada e confirmada no banco de homologacao.
