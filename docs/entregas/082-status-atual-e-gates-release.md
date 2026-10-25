# Entrega 082 - Status atual e gates de release

## Estado atual

- commit publicado: `97dc1e4`;
- CI `40238949808` verde em qualidade e empacotamento Windows;
- testes automatizados, typecheck, build, auditoria de dependencias, Compose, instaladores, diagnostico do host e smoke local do primeiro frame validados;
- agente Windows, operador nativo, painel web, relay H.264 e modo jogo experimental estao versionados;
- teclado/mouse funcionam no modo jogo; o gamepad possui mapa experimental para WASD, teclas comuns e mouse relativo.

## Gates que ainda exigem ambiente externo

1. Instalar o agente e o operador em duas maquinas Windows reais e testar LAN e internet.
2. Medir primeiro frame, FPS, RTT/p95, perda, reconexao, CPU/GPU e estabilidade por pelo menos um jogo.
3. Repetir o teste com host sem GPU dedicada, GPU integrada e GPU dedicada.
4. Validar UAC, tela bloqueada, troca de usuario, audio WASAPI e jogos que aceitem ou exijam controle real.
5. Configurar e validar a VPS com dominio, TLS/WSS, Redis TLS, backups, firewall, observabilidade e migracoes.
6. Assinar os instaladores com Authenticode e confirmar atualizacao e reparo sem erro de arquivo bloqueado.

## Decisao de release

O produto esta pronto para homologacao controlada, nao para prometer compatibilidade universal com jogos nem para publicar uma release aberta sem os gates acima. O modo jogo continua experimental e acessivel sem GPU dedicada quando o host possui captura/FFmpeg compativeis, mas a qualidade final depende de hardware, rede e do jogo testado.
