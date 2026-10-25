# Cliente operador nativo

Janela Windows do Remoto para abrir uma sessao `game` aprovada, com video H.264, teclado e mouse relativos. A autenticacao e o relay continuam no modulo `@remoto/desktop-control`; o renderer nao recebe o token.

## Teste local

Compile primeiro o transporte:

```powershell
npm install
npm run build -w apps/desktop-control
```

Na sessao web aprovada, use o botao `Cliente nativo` para baixar o descritor. Para um teste manual, o formato e este (use um token real somente no ambiente local):

```json
{
  "sessionId": "sessao-aprovada",
  "deviceId": "pc-remoto",
  "mode": "game",
  "role": "client",
  "accessToken": "token-de-uso-unico",
  "expiresAt": "2026-10-25T18:00:00.000Z",
  "apiUrl": "http://localhost:4100",
  "realtimeUrl": "ws://localhost:4200"
}
```

Abra a janela:

```powershell
npm run operator:dev -- --descriptor-file C:\temp\remoto-session.json
```

O arquivo e apagado depois da leitura. Antes de abrir o WebSocket, o cliente consome o token uma unica vez em `POST /desktop-sessions/consume`; `apiUrl` e `realtimeUrl` do descritor prevalecem, com fallback para `REMOTO_API_URL` e `REMOTO_REALTIME_URL`. Em endpoints remotos, somente HTTPS/WSS sao aceitos; HTTP/WS ficam restritos a loopback para desenvolvimento. A sessao exige `role: client`, `mode: game` e um relay acessivel.

## Instalador Windows

Gere o instalador x64 com atalho, menu iniciar e associacao `.remoto-session`:

```powershell
npm run operator:package:windows
```

O arquivo sai em `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`. O build local atual nao e assinado; para distribuicao publica ainda faltam certificado de assinatura, atualizacao automatica e teste em duas maquinas.

## Limites desta entrega

O cliente nativo agora possui janela, decodificacao MSE, pointer lock, teclado, mouse, mapa experimental de gamepad para teclado/mouse, encerramento e tratamento de fila de frames. Esse mapa nao cria um dispositivo XInput no host. Ainda falta o teste de duas maquinas Windows, instalador assinado e medicao real de FPS/RTT/perda em redes diferentes; por isso o modo jogo continua experimental e desativado por padrao na API.
