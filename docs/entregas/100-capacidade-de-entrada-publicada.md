# Entrega 100 - Capacidade de entrada publicada

## Entregue

- O agente inclui `software.input` no inventario.
- Teclado e mouse sao identificados como entrada por `SendInput`.
- O gamepad e identificado como `keyboard-mouse-map`.
- `virtualGamepad: false` e `haptics: false` deixam explicito que a build nao instala um dispositivo XInput/DirectInput virtual nem promete vibracao.
- O painel mostra essa capacidade na ficha do dispositivo antes da abertura da sessao.
- Um teste automatizado protege o contrato publicado pelo agente.

## Efeito no produto

O modo jogo continua acessivel sem GPU dedicada quando a captura por CPU e o FFmpeg estao disponiveis. Jogos que aceitam teclado e mouse podem usar o mapa experimental do controle. Jogos que exigem XInput/DirectInput continuam fora do suporte atual e nao devem ser anunciados como compativeis.

## Proxima fronteira tecnica

Suporte a gamepad real exige uma ponte de dispositivo virtual HID/XInput/DirectInput instalada e assinada no Windows, com ciclo de vida, permissao, remocao e testes por jogo. Essa etapa deve ser tratada como um componente separado e opcional, sem alterar o caminho acessivel de teclado/mouse nem esconder a ausencia do driver.
