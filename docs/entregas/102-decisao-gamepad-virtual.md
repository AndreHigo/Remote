# Entrega 102 - Decisao sobre gamepad virtual

## Evidencia tecnica

O ViGEmBus oficial foi arquivado e marcado como aposentado em novembro de 2023. Ele e um driver de kernel que emula controles Xbox 360 e DualShock 4; portanto, nao e uma dependencia pequena que possa ser copiada para dentro do agente sem assumir instalacao privilegiada, assinatura, atualizacao e suporte de driver.

Fonte oficial: [repositorio ViGEmBus](https://github.com/nefarius/ViGEmBus).

## Decisao do Remoto

- Nao incluir ViGEmBus, vJoy ou outro driver de terceiros no instalador atual.
- Manter o mapa `keyboard-mouse-map` como caminho acessivel e sem driver adicional.
- Nao anunciar suporte a jogos que exigem XInput/DirectInput, vibracao ou um controle fisico no host.
- Tratar gamepad virtual como um componente opcional, com fornecedor e licenca aprovados antes da implementacao.

## Contrato para uma futura implementacao

Um provedor de gamepad virtual so entra no produto depois de cumprir todos os pontos abaixo:

1. Driver Windows assinado, compatibilidade x64/ARM64 definida e origem verificavel.
2. Instalacao e remocao explicitas, com consentimento administrativo e rollback.
3. Deteccao de versao, estado do driver e falha fechada para o mapa teclado/mouse.
4. Ciclo de vida por sessao: criar, alimentar, liberar e remover o dispositivo sem deixar controle fantasma.
5. Testes com jogos que usam XInput, DirectInput, anti-cheat, UAC, bloqueio de tela e troca de usuario.
6. Telemetria local suficiente para diagnosticar driver ausente, assinatura invalida e perda de dispositivo.

Enquanto esses criterios nao forem atendidos em Windows real, a capacidade publicada pelo agente permanece `virtualGamepad: false`.
