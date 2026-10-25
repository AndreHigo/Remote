# Entrega 028 - Checklist antes da VPS

## Estado validado

- commit de referência: branch `main` no repositorio remoto;
- `npm test`: testes passando no estado atual;
- `npm run typecheck`: API, web, desktop-control, agent e realtime sem erros;
- `npm run build`: build completo validado no estado atual do workspace;
- `npm audit --audit-level=high`: 0 vulnerabilidades;
- `docker compose config`: configuracao local valida, com imagens de producao fixadas por digest;
- relay revalida salas a cada 10 segundos e fecha sessoes revogadas;
- logout, desativacao, reset de senha, arquivamento e fechamento nativo revogam sessoes;
- agente arquivado nao aceita heartbeat, inventario ou comandos;
- instalador do operador gerado localmente:
  `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`;
- SHA256 atual do instalador: `B28E0664FF202D991DC22E5530D8579EC78B18AB6EE94E4A66D82D0C468313F1`.
- instalador do agente Windows gerado localmente:
  `apps/agent/release/RemotoAgent-Setup.exe`;
- SHA256 atual do instalador do agente: `62F9CB61C4DD6DF784A7D2B3BD15BCEA3FA43E6F541AC10E05B9F240482C035F`;
- o instalador do agente encerra o serviço, o host do serviço e o processo interativo antes da atualização para evitar arquivo bloqueado.
- o operador nativo agora exibe RTT e tenta reconectar após queda transitória, conforme `docs/entregas/030-reconexao-e-rtt-operador.md`.
- o transporte do host preserva segmentos fMP4 completos antes de enviá-los ao relay, conforme `docs/entregas/032-segmentacao-fmp4-baixa-latencia.md`.
- o CI também executa os testes do agente e valida a sintaxe dos scripts do operador nativo, conforme `docs/entregas/033-ci-agente-e-operador.md`.
- o CI validou o empacotamento Windows do Agent e do Operator no run `40238949808`, no commit `97dc1e49fa37f5729257a3ae8dafdbdd0dcc9151`.
- a revisão de segurança do diff de descoberta/inicialização do RustDesk terminou com cobertura completa e zero achados reportáveis.
- `npm run validate:release`: testes, typecheck, build, auditoria, sintaxe, hashes e gate de áudio executados no workspace local.
- o bridge de entrada libera teclas e botões mantidos quando a sessão encerra, conforme `docs/entregas/039-liberacao-de-entrada.md`.
- o login passa para uma coluna em janelas menores para evitar corte horizontal, conforme `docs/entregas/040-login-responsivo.md`.
- o hardening de sessão, limites, seed, relay, RustDesk e release está registrado em `docs/entregas/041-hardening-seguranca-operacao.md`.
- o mapa experimental de gamepad para teclado/mouse está documentado em `docs/entregas/081-mapa-gamepad-teclado-mouse.md`; ele não cria um dispositivo XInput/DirectInput real no host.

## Fechamento antes da producao

1. O limite de instalacao agora esta explicito no schema e na migracao `0006_workspace_scope`: usuarios, clientes e todas as operacoes administrativas sao filtrados pelo workspace autenticado. O MVP continua workspace-wide dentro de cada workspace; memberships por cliente e papeis por cliente ficam para uma etapa posterior, caso o produto precise desse nivel de delegacao.
2. Configurar o certificado Authenticode no GitHub e publicar uma tag de teste; o workflow agora bloqueia a publicação se os instaladores não forem assinados e recalcula os checksums depois da assinatura. As imagens Docker continuam fixadas por digest.
3. Executar o teste de duas maquinas Windows seguindo `docs/entregas/029-runbook-homologacao-jogo.md`, primeiro na rede local e depois pela internet com HTTPS/WSS, medindo FPS, RTT, perda, CPU/GPU, UAC, troca de sessao, bloqueio de tela, gamepad e compatibilidade por jogo.
4. Configurar na VPS os segredos reais, dominio, TLS, banco, backup, firewall e observabilidade. O preflight de producao deve falhar se algum segredo obrigatorio estiver ausente.

## Decisao

O sistema está pronto para homologação controlada e para preparar a VPS. Os bloqueios para uma release pública continuam sendo a assinatura real dos binários, o teste entre duas máquinas e a configuração validada da VPS; a migração `0006_workspace_scope` ainda deve ser aplicada e confirmada no banco de homologação.
