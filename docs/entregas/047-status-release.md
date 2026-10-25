# Entrega 047 - Status da release de homologacao

## Estado atual

- commit de referencia: `814c4df`;
- CI remoto verde no GitHub Actions: [Remoto CI 40216604195](https://github.com/AndreHigo/Remote/actions/runs/40216604195);
- o CI passou nos testes de seguranca, agente, desktop-control e realtime;
- typecheck, build, preflight dos Compose e empacotamento Windows do Agent e do Operator passaram;
- o pacote Windows inclui o diagnostico automatico do host e a criacao da tarefa interativa de logon;
- a ultima entrega vinculou cada chave de cadastro ao primeiro `remoteId` que a utiliza;
- a mesma chave continua funcionando no mesmo computador, mas e recusada em outro;
- mover um dispositivo acompanha o escopo da chave; excluir o dispositivo revoga e limpa as chaves vinculadas.

## Validacao local

Executado no workspace:

```text
npm test
npm run typecheck
npm run validate:release -- -SkipAudit
npx prisma validate --schema services/api/prisma/schema.prisma
npx prisma migrate diff --from-migrations services/api/prisma/migrations --to-schema services/api/prisma/schema.prisma --script
```

## Bloqueios antes da VPS

1. Homologar duas maquinas Windows, incluindo CPU sem GPU dedicada, GPU integrada, GPU dedicada, reconexao, UAC, bloqueio de tela, troca de usuario e jogos reais.
2. Medir RTT medio/p95, perda, FPS, tempo ate primeiro frame e uso de CPU/GPU em rede local e internet.
3. Validar captura de audio de sistema com uma build FFmpeg que ofereca WASAPI loopback; ate la, o modo jogo permanece video-only.
4. Validar gamepad e jogos com anti-cheat; `SendInput` nao e garantia para protecoes de baixo nivel.
5. Configurar dominio, TLS, segredos, backup, firewall, observabilidade e aplicar a migracao em homologacao/VPS.
6. Assinar os instaladores com Authenticode e definir atualizacao assinada.

Enquanto esses itens nao forem executados, o produto esta pronto para homologacao controlada, nao para afirmar compatibilidade universal de jogos ou release publica.
