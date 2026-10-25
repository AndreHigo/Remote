# Entrega 042 - Fallback automatico de captura

## Entregue

- o perfil de encoder aceita `auto`;
- o host consulta os encoders H.264 publicados pela propria build do FFmpeg;
- `auto` prioriza NVIDIA, AMD e Intel nessa ordem;
- um encoder de GPU explicitamente configurado cai para `libx264` quando nao esta disponivel;
- CPU continua sendo o caminho funcional para computadores sem placa dedicada;
- testes cobrem selecao automatica e fallback de hardware.

## Impacto

O usuario nao precisa saber qual GPU existe no computador remoto. O mesmo agente tenta a aceleracao disponivel e mantem a sessao de video quando so houver CPU.

## Limites honestos

- a listagem do FFmpeg confirma que o encoder existe na build, mas nao substitui teste real do driver;
- qualidade, RTT, FPS e perda ainda precisam ser medidos entre duas maquinas;
- audio de sistema, gamepad, clipboard, bloqueio de tela e anti-cheat continuam gates externos do modo jogo.

## Validacao

```powershell
npm test -w apps/desktop-control
npm test -w apps/agent
npm run typecheck -w apps/desktop-control
npm run typecheck -w apps/agent
```
