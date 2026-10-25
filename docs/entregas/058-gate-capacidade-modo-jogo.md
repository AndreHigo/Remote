# Entrega 058: gate de capacidade do modo jogo

## O que foi feito

- A aprovacao de uma sessao de jogo agora exige que o ultimo inventario do dispositivo seja recente.
- O inventario precisa publicar `software.capture.gameModeReady=true`.
- Inventario ausente, desatualizado, invalido ou com captura nao pronta retorna `409` com uma orientacao administrativa clara.
- Sessoes de suporte continuam independentes do inventario de captura.
- A regra foi isolada em uma funcao pura e coberta por testes.

## Limite

O gate confirma capacidade declarada pelo agente, nao desempenho real. Ele nao substitui teste de duas maquinas, medicao de RTT/FPS/perda, audio, gamepad ou compatibilidade com anti-cheat.
