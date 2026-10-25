# Entrega 038 - Empacotamento Windows no CI

## Entregue

- o CI ganhou um job `windows-package` em runner Windows;
- Agent e Operator nativo são empacotados em cada push e pull request;
- o job garante o Inno Setup quando necessário;
- os três artefatos são verificados por existência e SHA256;
- cada execução publica por 14 dias os instaladores, o ZIP do agente e um manifesto SHA256 como artefato baixável `remoto-windows-<commit>`.

## Limite

O job valida compilação e empacotamento e disponibiliza os arquivos para teste, mas não substitui instalar o pacote em uma máquina Windows real, abrir uma sessão remota ou medir jogo, áudio, gamepad, RTT e perda. Os binários continuam sem assinatura Authenticode até existir um certificado configurado.
