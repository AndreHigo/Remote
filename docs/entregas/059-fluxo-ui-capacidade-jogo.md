# Entrega 059: capacidade visivel no fluxo de sessao

## O que foi feito

- Ao abrir uma sessao pela lista, o dispositivo e selecionado antes do modal aparecer.
- O modal mostra a capacidade publicada pelo inventario do dispositivo selecionado.
- O painel diferencia captura pronta, captura nao pronta e capacidade ainda nao avaliada.
- O inventario anterior e limpo imediatamente quando o dispositivo muda, evitando misturar diagnosticos de computadores diferentes.
- A aprovacao definitiva continua protegida pelo gate da API; a mensagem do painel e orientativa e nao substitui a validacao do servidor.

## Validacao

- Typecheck do frontend passou.
- Build de producao do frontend passou.
- O smoke da API e do agente continua aprovado apos o gate de capacidade.
