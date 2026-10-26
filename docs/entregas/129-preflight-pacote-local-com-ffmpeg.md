# Entrega 129 - Pacote local do agente com FFmpeg protegido

Foi gerado um pacote local do agente Windows com:

- instalador grafico `RemotoAgent-Setup.exe`;
- servico Windows e tarefa interativa `RemotoAgentDesktop`;
- `repair-installed-agent.ps1` e diagnostico do host;
- FFmpeg dentro de `ffmpeg\ffmpeg.exe`, acompanhado de licenca, README e avisos de terceiros;
- fallback de captura por CPU e suporte a encoder acelerado quando a build oferece o recurso.

Artefatos locais, ignorados pelo Git:

- `apps/agent/release/RemotoAgent-Setup.exe`;
- `apps/agent/release/RemotoAgent-Windows.zip`.

O instalador local gerado nesta homologacao teve SHA-256 `4CB6A3FA58EB8746FFE360ADA7E889EB27B941653701C1FC7DD6721337B857CA`.

## Validacao

`npm run validate:release` passou com:

- 90 testes;
- typecheck e build de todos os workspaces;
- auditoria de dependencias sem vulnerabilidades;
- validacao do instalador e das ACLs;
- confirmacao de que a build local do FFmpeg nao oferece WASAPI.

Este artefato e local e nao assinado. Antes de distribuicao publica ainda sao necessarios assinatura Authenticode, origem/hash/licenca aprovados para a release, instalacao elevada e teste em uma segunda maquina.
