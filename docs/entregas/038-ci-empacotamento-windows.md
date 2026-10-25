# Entrega 038 - Empacotamento Windows no CI

## Entregue

- o CI ganhou um job `windows-package` em runner Windows;
- Agent e Operator nativo são empacotados em cada push e pull request;
- o job garante o Inno Setup quando necessário;
- os três artefatos são verificados por existência e SHA256;
- o workflow de release continua responsável por guardar artefatos e publicar tags.

## Limite

O job valida compilação e empacotamento, mas não substitui instalar o pacote em uma máquina Windows real, abrir uma sessão remota ou medir jogo, áudio, gamepad, RTT e perda.
