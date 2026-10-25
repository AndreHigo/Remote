# Entrega 045 - Captura com Desktop Duplication

## O que mudou

O agente passou a escolher automaticamente o metodo de captura do Windows. Quando o FFmpeg oferece o filtro `ddagrab`, a captura usa o Desktop Duplication API, mais adequado para jogos em tela cheia e transicoes de janela. Builds sem esse filtro continuam usando `gdigrab`.

O encoder permanece independente do metodo de captura: `auto` prioriza NVIDIA, AMD e Intel, com fallback para `libx264` por CPU. Assim, computadores sem placa de video dedicada continuam elegiveis para o modo jogo, com qualidade e latencia condicionadas ao processador e a rede.

## Configuracao

`REMOTO_CAPTURE_METHOD` aceita `auto`, `ddagrab` ou `gdigrab`. O padrao e `auto`; solicitar `ddagrab` em uma build sem o filtro cai para `gdigrab`.

## Limites

Isso melhora a estrategia de captura, mas nao prova compatibilidade com todos os jogos. Ainda e necessario homologar entre duas maquinas Windows, medir RTT/FPS/perda e testar jogos com anti-cheat, UAC, tela bloqueada e troca de sessao.
