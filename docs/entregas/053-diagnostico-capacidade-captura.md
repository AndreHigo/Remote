# Entrega 053 - Diagnostico real da capacidade de captura

## O que foi entregue

O inventario do agente deixou de considerar apenas a existencia do executavel FFmpeg. Ele agora consulta a propria build para informar:

- se existe encoder H.264 por CPU (`libx264`) ou acelerado (`h264_nvenc`, `h264_amf`, `h264_qsv`);
- qual encoder sera escolhido pelo perfil `auto`;
- se o encoder escolhido pelo perfil realmente existe na build, inclusive quando o usuario fixa CPU ou uma GPU especifica;
- se `gdigrab` e/ou `ddagrab` estao disponiveis;
- qual metodo de captura sera usado;
- se o fallback de CPU esta realmente ativo.

O campo `gameModeReady` so fica pronto quando ha um encoder H.264 e o metodo escolhido esta disponivel. Portanto, uma maquina sem placa de video dedicada continua elegivel quando possui `libx264`, mas o painel passa a mostrar o motivo quando a build do FFmpeg nao consegue capturar ou codificar.

## Validacao

```powershell
npm test -w apps/agent
npm test -w apps/desktop-control
npm run typecheck -w apps/agent
npm run typecheck -w apps/desktop-control
npm run typecheck -w apps/web
```

## Ainda falta

O diagnostico confirma capacidade publicada pela build, nao desempenho real. Ainda e necessario medir FPS, RTT, perda, CPU/GPU e compatibilidade em duas maquinas Windows, incluindo um host sem GPU dedicada. Audio de sistema, gamepad, UAC, bloqueio de tela e anti-cheat continuam gates de homologacao.
