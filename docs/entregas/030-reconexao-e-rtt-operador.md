# Entrega 030 - Reconexao e RTT no operador nativo

## Entregue

- o transporte nativo envia pings autenticados e calcula RTT a partir do `pong` do relay;
- o cliente operador exibe o RTT junto do FPS recebido;
- quedas de socket ou falhas transitórias tentam reconectar com backoff de 500 ms ate 15 s;
- o reconnect reutiliza o token ja consumido e autorizado, sem reabrir a sessao administrativa;
- o fechamento manual cancela tentativas pendentes, encerra o socket e revoga a sessao na API;
- a captura e a ponte de entrada sao liberadas sempre que o socket encerra;
- erros de socket deixam de ficar sem listener no processo nativo.

## Validacao

```powershell
npm test -w apps/desktop-control
npm run typecheck -w apps/desktop-control
node --check apps/operator/src/main.cjs
node --check apps/operator/src/renderer.js
node --check apps/operator/src/preload.cjs
```

O teste de transporte confirma frame, entrada tipada, RTT e fechamento de socket. O instalador atualizado foi gerado em `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`, com SHA256 `3971F20D1213F694F2A699D70A942397EFB2A9C948D205D496BE56BB97AB4C00`. Ainda falta validar a reconexao com duas maquinas Windows e uma interrupcao real de rede.

## Ainda falta

- áudio, gamepad e clipboard no operador nativo;
- homologacao real em rede local e internet;
- assinatura Authenticode do instalador e dos binarios Windows.
