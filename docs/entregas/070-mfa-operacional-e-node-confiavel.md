# 070 - MFA operacional e Node confiavel no servico Windows

## Entregue

- Em producao, owner, admin e tecnico sem 2FA ficam limitados ao fluxo de configuracao do autenticador; rotas operacionais retornam `two_factor_required` ate a ativacao.
- O bootstrap da conta permanece funcional: `/auth/me` e `/auth/logout` continuam disponiveis para que o usuario chegue ao painel e conclua a configuracao, sem liberar dados operacionais.
- Tecnicos podem consultar, preparar e ativar o proprio TOTP, mas nao podem desativar a protecao.
- Ativar ou desativar o 2FA incrementa `sessionVersion`, revoga sessoes existentes e retorna o operador ao login para uma nova autenticacao.
- O painel exibe a area de seguranca para tecnicos sem liberar clientes, usuarios, dispositivos arquivados ou chaves de agente.
- O instalador PowerShell do servico rejeita `node.exe` fora de `Program Files`, `Program Files (x86)` ou `LocalAppData\Programs` antes de registrar o servico e a tarefa interativa.

## Validacao

- `npm run test:security`
- `npm run typecheck`
- `npm run build`
- parser do PowerShell para os scripts de instalacao e backup
- CI `40230102173`: qualidade e pacote Windows verdes

## Limites restantes

- A auditoria de seguranca oficial iniciada no workspace ainda nao concluiu a fase de modelo de ameaca.
- O rate limit distribuido agora exige Redis em producao; quotas especificas por dispositivo e monitoramento de chaves ainda ficam para uma etapa posterior.
- O modo jogo ainda exige homologacao entre duas maquinas, medicao de rede, audio, gamepad, telas protegidas e anti-cheat.
