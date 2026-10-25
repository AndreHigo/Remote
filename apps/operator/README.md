# Cliente operador nativo

Janela Windows do Remoto para abrir uma sessao `game` aprovada, com video H.264, teclado e mouse relativos. A autenticacao e o relay continuam no modulo `@remoto/desktop-control`; o renderer nao recebe o token.

## Teste local

Compile primeiro o transporte:

```powershell
npm install
npm run build -w apps/desktop-control
```

Crie um arquivo temporario com um descritor entregue pela API (use um token real somente no ambiente local):

```json
{
  "sessionId": "sessao-aprovada",
  "deviceId": "pc-remoto",
  "mode": "game",
  "role": "client",
  "accessToken": "token-de-uso-unico",
  "expiresAt": "2026-10-25T18:00:00.000Z"
}
```

Abra a janela:

```powershell
npm run operator:dev -- --descriptor-file C:\temp\remoto-session.json
```

O arquivo e apagado depois da leitura. Antes de abrir o WebSocket, o cliente consome o token uma unica vez em `POST /desktop-sessions/consume`; configure `REMOTO_API_URL` quando a API nao estiver em `http://localhost:4100`. A sessao exige `role: client`, `mode: game`, `accessToken` e um relay acessivel pela configuracao `REMOTO_REALTIME_URL`.

## Limites desta entrega

O cliente nativo agora possui janela, decodificacao MSE, pointer lock, teclado, mouse, encerramento e tratamento de fila de frames. Ainda falta o teste de duas maquinas Windows, instalador assinado e medicao real de FPS/RTT/perda em redes diferentes; por isso o modo jogo continua experimental e desativado por padrao na API.
