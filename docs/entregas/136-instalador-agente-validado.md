# Entrega 136 - Instalador do agente validado

## Problemas corrigidos

- O instalador nao acessa mais o constante `{app}` antes da inicializacao do diretorio.
- A configuracao anterior e lida pelo caminho protegido padrao durante a abertura do wizard.
- A atualizacao reutiliza o servico existente, evitando corrida de remocao e recriacao no Windows.
- A parada da tarefa interativa so usa `schtasks` quando a tarefa realmente existe.
- O script registra etapas administrativas sem gravar a chave do agente, facilitando diagnostico de instalacao.

## Validacao no host

- Instalador executado em `DESKTOP-DB26883`.
- Servico `RemotoAgent`: `Running`, inicializacao `AutoStart`.
- Tarefa `RemotoAgentDesktop`: `Running`.
- Processo interativo: ativo e pronto.
- FFmpeg: caminho protegido em `C:\Program Files\Remoto Agent\ffmpeg\ffmpeg.exe`.
- API: `http://localhost:4100`.
- Relay: `ws://localhost:4200`.

## Gates

- `npm run validate:release`: aprovado.
- `npm audit`: 0 vulnerabilidades.
- Audio WASAPI: ainda depende de uma build do FFmpeg com loopback WASAPI; o host atual permanece video-only para esse recurso.
