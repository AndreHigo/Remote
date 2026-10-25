# Entrega 081 - Mapa de gamepad para teclado e mouse

## Entregue

- O cliente web e o operador nativo consultam o Gamepad API local.
- Analogo esquerdo vira `WASD`.
- Analogo direito vira movimento relativo do mouse.
- Botoes padrao viram espaco, escape, enter, modificadores e teclas comuns.
- Zona morta reduz ruido do analogo e as teclas sao liberadas quando o controle desconecta.

## Limites

O recurso e uma traducao para teclado/mouse. Nao cria dispositivo XInput/DirectInput no host, nao oferece vibracao e nao atende jogos que exigem gamepad real. A compatibilidade precisa ser medida por jogo em duas maquinas Windows.
