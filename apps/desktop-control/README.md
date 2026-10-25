# Desktop Control

Aplicativo desktop nativo unico do Remoto para tecnicos e para o modo jogo.

Responsabilidades:

- abrir sessoes remotas com parametros seguros;
- integrar com o painel web;
- manter experiencia mais nativa no Windows;
- iniciar sessoes `support` e `game` sem expor o motor tecnico ao usuario;
- reportar estado, latencia, FPS e motivo de incompatibilidade ao painel.

O usuario deve instalar e abrir apenas o Remoto. A mesma aplicacao tera perfis Host e Cliente e escolhera a estrategia de captura, codificacao e entrada conforme o hardware disponivel. Nao exigir placa de video dedicada quando o computador puder usar video integrado ou fallback de CPU.

O painel pode entregar um `desktopSession` aprovado ao cliente nativo. Esse descritor e o contrato comum de sessao; ele nao deve conter senha ou segredo reutilizavel.

Stack candidata:

- Tauri;
- React;
- Rust para integracoes locais.

Estado atual: contrato, captura, entrada e transporte realtime autenticado estao implementados para o host Windows. O painel web possui o cliente experimental do modo jogo e `apps/operator` fornece uma janela nativa inicial para o operador.

O modulo `capture.ts` monta uma captura Windows de baixa latencia via FFmpeg. O metodo `auto` prioriza `ddagrab` (Desktop Duplication API) quando disponivel para melhorar jogos em tela cheia e cai para `gdigrab` quando necessario. O perfil de encoder `auto` detecta os encoders H.264 publicados pela build local, prioriza aceleracao NVIDIA/AMD/Intel e sempre cai para `libx264` por CPU quando a GPU, o driver ou a build nao forem compativeis. O modulo `input.ts` valida eventos tipados e usa uma ponte Windows isolada para SendInput. O modulo `realtime.ts` conecta o host ao relay autenticado e envia video e entrada somente dentro da sessao aprovada.

O modulo `operator.ts` e a fronteira do cliente nativo operador: aceita somente `role: client` no modo `game`, entrega frames ao renderer escolhido pela aplicacao, informa quando o peer host entrou e mantem entrada/encerramento no mesmo contrato realtime. A primeira janela Electron fica em `apps/operator`; ela nao duplica autenticacao ou protocolo e recebe o descritor por arquivo de uso unico. O `GameEngine` detecta o instalador ou a arvore Electron local, cria esse descritor em uma pasta temporaria e inicia o operador sem colocar o token na linha de comando.

Diagnostico local:

```powershell
npm run status -w apps/desktop-control -- status support
npm run status -w apps/desktop-control -- status game

$env:REMOTO_SESSION_DESCRIPTOR = '{"sessionId":"sessao-1","deviceId":"pc-1","mode":"support","role":"client","accessToken":"token-entregue-pela-api"}'
npm run open -w apps/desktop-control

# Em uma sessao aprovada, o descritor deve conter accessToken; o cliente o consome uma unica vez.
```

