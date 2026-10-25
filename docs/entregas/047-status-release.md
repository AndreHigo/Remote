# Entrega 047 - Status da release de homologacao

## Estado atual

- commit de referencia: `5606083`;
- CI remoto verde no GitHub Actions: [Remoto CI 40219712552](https://github.com/AndreHigo/Remote/actions/runs/40219712552);
- o CI passou nos testes de seguranca, agente, desktop-control e realtime;
- typecheck, build, preflight dos Compose e empacotamento Windows do Agent e do Operator passaram;
- o pacote Windows inclui o diagnostico automatico do host e a criacao da tarefa interativa de logon;
- a ultima entrega vinculou cada chave de cadastro ao primeiro `remoteId` que a utiliza;
- a mesma chave continua funcionando no mesmo computador, mas e recusada em outro;
- mover um dispositivo acompanha o escopo da chave; excluir o dispositivo revoga e limpa as chaves vinculadas;
- o autostart interativo do modo jogo usa a tarefa `RemotoAgentDesktop` com logon interativo e remove o fallback legado quando o Agendador de Tarefas esta disponivel;
- os endpoints de sessao e comandos limitam motivo, chaves e payloads operacionais antes de persistir ou encaminhar dados;
- o smoke test local pode ser repetido com `npm run smoke:local`, validando Postgres, API, relay, cadastro do agente e conexao do host.
- o procedimento de restauracao do backup criptografado esta versionado em `infra/docker/restore-postgres.ps1` e exige `-ConfirmRestore`.

## Validacao local

Executado no workspace:

```text
npm test
npm run typecheck
npm run validate:release -- -SkipAudit
npx prisma validate --schema services/api/prisma/schema.prisma
npx prisma migrate diff --from-migrations services/api/prisma/migrations --to-schema services/api/prisma/schema.prisma --script
```

O CI do commit `5606083` tambem passou na auditoria de dependencias, nos testes de seguranca, no typecheck, no build, no preflight dos Compose e no empacotamento Windows do Agent e do Operator.

A auditoria estrutural de seguranca do commit `8053b42` terminou sem achados validados nas superficies criticas revisadas. A cobertura foi source-backed e parcial: ainda nao substitui homologacao em duas maquinas, teste pela internet ou revisao independente em ambiente de producao. O limite de payload adicionado em `d1c6fe6` foi validado separadamente por testes e typecheck.

## Bloqueios antes da VPS

1. Homologar duas maquinas Windows, incluindo CPU sem GPU dedicada, GPU integrada, GPU dedicada, reconexao, UAC, bloqueio de tela, troca de usuario e jogos reais.
2. Medir RTT medio/p95, perda, FPS, tempo ate primeiro frame e uso de CPU/GPU em rede local e internet.
3. Validar captura de audio de sistema com uma build FFmpeg que ofereca WASAPI loopback; ate la, o modo jogo permanece video-only.
4. Validar gamepad e jogos com anti-cheat; `SendInput` nao e garantia para protecoes de baixo nivel.
5. Configurar dominio, TLS, segredos, backup, firewall, observabilidade e aplicar a migracao em homologacao/VPS.
6. Assinar os instaladores com Authenticode e definir atualizacao assinada.

Enquanto esses itens nao forem executados, o produto esta pronto para homologacao controlada, nao para afirmar compatibilidade universal de jogos ou release publica.
