# Entrega 130 - Smoke local completo do canal de jogo

## Resultado

Em 26/10/2026, o comando `npm run smoke:local` foi executado com sucesso no workspace local. O script aceita `-CaptureEncoder auto|cpu|nvidia|amd|intel` e `-CaptureMethod auto|gdigrab|ddagrab` para comparar o fallback acessivel com a aceleracao disponivel no host.

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
- medicao local de 5 segundos com FPS, bitrate, RTT medio/p95 e descartes do relay;
- encerramento e limpeza dos processos e do container local.

## Evidencia

O smoke terminou com codigo `0` e informou:

`Smoke test local aprovado: API, banco, agente, captura FFmpeg, primeiro frame, sessao game e relay.`

O relay tambem recebeu um frame inicial valido contendo a inicializacao fMP4 esperada. A medicao agora e executada pelo proprio smoke e deixa um relatorio temporario JSON antes da limpeza.

Na execucao local mais recente, a medicao registrou primeiro frame em `38 ms`, aproximadamente `2 FPS`, `3458.33 kbps`, RTT medio de `1.5 ms`, RTT p95 de `2 ms` e zero descartes do relay. Esses numeros sao apenas uma referencia do mesmo computador e nao representam uma conexao pela internet.

## Perfil automatico e compatibilidade de encoder

O smoke tambem foi executado com `-CaptureEncoder auto -CaptureMethod auto` depois da inclusao de um probe real de uma frame para encoders acelerados. O host lista `h264_nvenc`, mas o driver instalado oferece API NVENC `13.0` enquanto a build local exige `13.1`; o probe recusou o hardware e o agente caiu para `libx264` com `gdigrab` sem derrubar a sessao.

Essa execucao terminou aprovada com primeiro frame em `43 ms`, aproximadamente `1.8 FPS`, `2727.67 kbps`, RTT medio de `0.5 ms`, RTT p95 de `1 ms` e zero descartes. O resultado confirma fallback funcional, mas tambem mostra que a qualidade de jogo depende de um encoder/captura acelerados compativeis no host.

## Limites

Este teste confirma o caminho local entre os processos, mas nao prova a experiencia final em duas maquinas. Ainda precisam de homologacao externa:

- teclado e mouse pelo cliente nativo;
- latencia, FPS, perda e reconexao em rede real;
- audio de sistema via WASAPI;
- gamepad e jogos que exigem XInput/DirectInput;
- UAC, tela bloqueada e anti-cheat;
- instalacao elevada no computador do usuario e configuracao da VPS.
