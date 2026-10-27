# Entrega 142 - Controle absoluto no fallback do navegador

## Problema

Quando o Chrome bloqueava o Pointer Lock, a sessão continuava mostrando o vídeo, mas o navegador enviava apenas deslocamentos relativos. A posição local do cursor não correspondia à posição do cursor no computador remoto, fazendo cliques chegarem em locais errados ou parecerem sem efeito.

## Implementação

- o navegador mapeia a posição clicada no vídeo para as coordenadas globais do monitor remoto;
- o relay aceita eventos `mouse.absolute` tipados e limitados;
- a ponte Windows converte a coordenada virtual para `SendInput` com `MOUSEEVENTF_ABSOLUTE` e `MOUSEEVENTF_VIRTUALDESK`;
- o Pointer Lock continua usando movimento relativo, preservando o caminho de menor latência para jogos;
- movimentos absolutos são enviados também antes de pressionar ou soltar um botão;
- testes cobrem validação, serialização e parsing do novo evento.

## Verificação

- o agente local foi reconstruído com o suporte absoluto;
- o teste direto da ponte moveu o cursor no Windows e abriu o menu Iniciar;
- a sessão web transmitiu vídeo H.264 a 30 FPS, publicou os dois monitores e enviou `mouse.absolute` pelo relay;
- typecheck e testes unitários do desktop-control e realtime passaram.

## Limite conhecido

O modo jogo que exige Pointer Lock continua dependendo do navegador permitir captura exclusiva. Quando isso não ocorre, o fallback é adequado para suporte e desktop; para jogos, o cliente nativo ainda é o caminho de baixa latência a concluir.
