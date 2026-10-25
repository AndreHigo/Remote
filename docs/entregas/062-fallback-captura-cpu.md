# 062 - Fallback de captura para CPU

## Entregue

Quando o perfil `auto` resolve o encoder H.264 por CPU (`libx264`), o desktop-control agora escolhe `gdigrab` em vez de assumir que a presença do filtro `ddagrab` garante uma captura utilizavel. Isso reduz a dependência de Desktop Duplication em computadores sem GPU dedicada e mantém a selecao explicita de `ddagrab` para hosts que precisarem dela.

O comportamento foi coberto por testes unitarios para os caminhos CPU, GPU e selecao explicita. Quando o perfil esta em `auto` e o host cai para CPU, a captura inicia em 30 FPS e 3,5 Mbps para priorizar estabilidade e evitar saturacao; perfis explicitos continuam respeitando os valores solicitados.

## Limite conhecido

Essa escolha melhora compatibilidade, mas nao garante desempenho: FPS, uso de CPU, RTT, perda e compatibilidade com jogos ainda precisam ser medidos em duas maquinas Windows. O modo continua sem garantia para gamepad real, UAC ou anti-cheat.
