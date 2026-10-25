# Entrega 034 - Preflight local de release

## Entregue

- comando unico `npm run validate:release`;
- testes, typecheck, build e auditoria de dependencias executados em sequencia;
- validacao de sintaxe dos scripts Electron do operador;
- SHA256 dos instaladores existentes;
- diagnostico explicito de WASAPI, sem declarar audio de jogo quando a build local do FFmpeg nao oferece loopback;
- aviso quando existem alteracoes locais nao commitadas.

## Uso

```powershell
npm run validate:release
```

Durante uma iteracao curta, o build e a auditoria podem ser pulados:

```powershell
npm run validate:release -- -SkipBuild -SkipAudit
```

## Limites

Este preflight confirma a consistencia local do workspace. Ele nao substitui homologacao entre duas maquinas Windows, medicao de RTT/FPS/perda, teste de gamepad, assinatura Authenticode ou configuracao da VPS.
