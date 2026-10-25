# Entrega 028 - Checklist antes da VPS

## Estado validado

- commit de referência publicado: `a0b3717`;
- `npm test`: 27 testes passando;
- `npm run typecheck`: API, web, desktop-control, agent e realtime sem erros;
- `npm run build`: build completo validado antes do escopo de workspace;
- `npm audit --audit-level=high`: 0 vulnerabilidades;
- `docker compose config`: configuracao local valida, com imagens de producao fixadas por digest;
- relay revalida salas a cada 10 segundos e fecha sessoes revogadas;
- logout, desativacao, reset de senha, arquivamento e fechamento nativo revogam sessoes;
- agente arquivado nao aceita heartbeat, inventario ou comandos;
- instalador do operador gerado localmente:
  `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`;
- SHA256 do instalador: `3B541BCACC485EFAE73815AC18BE18CF9E8246C0A09CFCA166E01F5C6D661E52`.

## Pendencias que bloqueiam producao

1. O limite de instalacao agora esta explicito no schema e na migracao `0006_workspace_scope`: usuarios, clientes e todas as operacoes administrativas sao filtrados pelo workspace autenticado. O MVP continua workspace-wide dentro de cada workspace; memberships por cliente e papeis por cliente ficam para uma etapa posterior, caso o produto precise desse nivel de delegacao.
2. Assinar o instalador e os binarios Windows com Authenticode e publicar checksums assinados. As imagens Docker agora estao fixadas por digest e as ferramentas do pacote do agente ficam declaradas no lockfile; o script usa `npx --no-install` e falha se elas nao estiverem disponiveis localmente.
3. Executar o teste de duas maquinas Windows, primeiro na rede local e depois pela internet com HTTPS/WSS, medindo FPS, RTT, perda, CPU/GPU, UAC, troca de sessao, bloqueio de tela, gamepad e compatibilidade por jogo.
4. Configurar na VPS os segredos reais, dominio, TLS, banco, backup, firewall e observabilidade. O preflight de producao deve falhar se algum segredo obrigatorio estiver ausente.

## Decisao

O sistema esta pronto para homologacao controlada e para preparar a VPS, mas nao deve ser anunciado como release publica antes das tres pendencias operacionais acima e da confirmacao da migracao `0006_workspace_scope` no banco de homologacao.
