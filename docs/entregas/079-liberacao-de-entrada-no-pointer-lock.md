# Entrega 079 - Liberacao de entrada no pointer lock

## Entregue

- O cliente web e o operador nativo rastreiam botoes do mouse mantidos durante uma sessao.
- Blur da janela, troca de visibilidade e perda do pointer lock enviam `up` para botoes e teclas ainda pressionados.
- A sessao nao deixa um clique ou tecla preso quando o operador muda de janela ou perde o foco do video.

## Validacao

- Typecheck do frontend passou.
- Sintaxe do renderer Electron passou.
- Testes do operador passaram.

## Limite

Este mecanismo protege a entrada de teclado e mouse. Nao implementa gamepad virtual nem altera as limitacoes de UAC, desktop seguro ou anti-cheat.
