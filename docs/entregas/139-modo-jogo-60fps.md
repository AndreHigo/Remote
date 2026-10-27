# 139 - Modo jogo com perfil de 60 FPS

## Entregue

O agente agora escolhe um perfil específico para sessões `game` sem alterar o perfil conservador do modo suporte:

- 60 FPS;
- qualidade `balanced` e bitrate padrão de 7000 kbps;
- `ddagrab` quando disponível, inclusive no fallback de CPU;
- conversão explícita de frames D3D11 para `libx264`, evitando falha de formato em builds atuais do FFmpeg;
- troca de monitor preservando o mesmo perfil de jogo.

## Homologação local

Na máquina Windows `DESKTOP-DB26883`, com dois monitores e NVIDIA GeForce GTX 1060 6GB:

- `ddagrab + libx264 ultrafast`: aproximadamente 55 FPS no teste direto do FFmpeg;
- sessão real pelo painel: estabilizou em 60 FPS;
- RTT observado: 1 a 4 ms;
- primeiro segundo da sessão: 30 FPS durante o preenchimento inicial do buffer, depois 60 FPS estáveis;
- processo real confirmado: `ddagrab=framerate=60`, `libx264`, `-g 30`, `7000k`.

## Limite conhecido

O FFmpeg empacotado lista `h264_nvenc`, mas o driver instalado oferece NVENC API `13.0` e a build exige `13.1`/driver `610+`. O agente detecta essa incompatibilidade e usa CPU + Desktop Duplication, sem fingir aceleração disponível. Para reduzir uso de CPU e melhorar margem em jogos pesados, atualizar o driver NVIDIA ou distribuir uma build do FFmpeg compatível com o driver será a próxima otimização.

Esta medição é local. A homologação pela internet ainda precisa medir perda, jitter, uso de CPU/GPU, áudio, controle, gamepad e compatibilidade por jogo.
