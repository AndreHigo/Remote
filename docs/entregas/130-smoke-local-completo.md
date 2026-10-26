# Entrega 130 - Smoke local completo do canal de jogo

## Resultado

Em 26/10/2026, o comando `npm run smoke:local` foi executado com sucesso no workspace local.

O fluxo validado foi:

- subida do PostgreSQL local;
- sincronizacao do schema e seed;
- subida da API e do relay realtime;
- cadastro e heartbeat do agente;
- bloqueio correto de uma sessao game sem inventario atualizado;
- coleta de inventario e comandos;
- aprovacao da sessao game;
- conexao do agente como host;
- captura FFmpeg;
- recebimento do primeiro frame fMP4 pelo cliente realtime;
- encerramento e limpeza dos processos e do container local.

## Evidencia

O smoke terminou com codigo `0` e informou:

`Smoke test local aprovado: API, banco, agente, captura FFmpeg, primeiro frame, sessao game e relay.`

O relay tambem recebeu um frame inicial valido contendo a inicializacao fMP4 esperada.

## Limites

Este teste confirma o caminho local entre os processos, mas nao prova a experiencia final em duas maquinas. Ainda precisam de homologacao externa:

- teclado e mouse pelo cliente nativo;
- latencia, FPS, perda e reconexao em rede real;
- audio de sistema via WASAPI;
- gamepad e jogos que exigem XInput/DirectInput;
- UAC, tela bloqueada e anti-cheat;
- instalacao elevada no computador do usuario e configuracao da VPS.
