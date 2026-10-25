# Entrega 027 - Cliente operador instalavel

## Entregue

- janela Electron nativa para o operador do modo jogo;
- transporte `@remoto/desktop-control` empacotado em bundle independente;
- consumo do token em `POST /desktop-sessions/consume` antes do relay;
- descritor `.remoto-session` de uso unico baixado pelo painel;
- instalador NSIS x64 com atalho, menu iniciar e associacao do arquivo de sessao;
- `GameEngine` detecta o operador instalado ou a arvore Electron local e inicia a sessao com descritor temporario;
- fila MSE com limite, pointer lock, teclado, mouse relativo e encerramento;
- encerramento nativo revoga a sessao na API, inclusive quando o operador fecha a janela;
- endpoint/realtime remoto exigem HTTPS/WSS e o agente arquivado nao aceita mais heartbeat, inventario ou comandos;
- artefato local `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`.

## Validacao

```powershell
npm run operator:package:windows
npm run typecheck
npm test
npm audit --audit-level=high
```

O instalador foi gerado localmente com sucesso. SHA256 do artefato desta entrega: `3B541BCACC485EFAE73815AC18BE18CF9E8246C0A09CFCA166E01F5C6D661E52`.

## Ainda falta

- assinatura Authenticode e atualizacao automatica;
- teste visual e funcional entre duas maquinas Windows em rede local e internet;
- medicao de FPS, RTT, perda, CPU/GPU e compatibilidade por jogo;
- validar UAC, bloqueio de tela, troca de sessao e anti-cheat sem tentar contorna-lo;
- gamepad, audio, clipboard e reconexao visual no cliente nativo.
