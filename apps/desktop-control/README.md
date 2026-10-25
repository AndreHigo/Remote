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

Estado atual: contrato e selecao de engine compilaveis; o transporte de video e entrada ainda precisa ser implementado.

O modulo `capture.ts` ja monta uma captura Windows de baixa latencia via FFmpeg, com CPU como caminho acessivel e encoders de GPU como aceleracao opcional. O modulo `input.ts` valida eventos tipados e usa uma ponte Windows isolada para SendInput. Nenhum dos dois e exposto em uma sessao remota ate existir transporte autenticado.

Diagnostico local:

```powershell
npm run status -w apps/desktop-control -- status support
npm run status -w apps/desktop-control -- status game

$env:REMOTO_SESSION_DESCRIPTOR = '{"sessionId":"sessao-1","deviceId":"pc-1","mode":"support","role":"client","remoteId":"123 456 789"}'
npm run open -w apps/desktop-control
```

