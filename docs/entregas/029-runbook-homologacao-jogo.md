# Entrega 029 - Runbook de homologacao do modo jogo

## Objetivo

Validar o caminho completo entre o painel, o agente Windows e o cliente operador antes de habilitar o modo jogo em uma VPS.

## Preparacao

1. Use duas maquinas Windows na mesma rede para o primeiro teste. A maquina host deve ter uma sessao de usuario ativa e bloqueio de tela desativado durante a captura.
2. Instale o `RemotoAgent-Setup.exe` na maquina host, informe a URL da API, a URL do relay e uma chave de agente criada para o cliente correto.
3. Confirme no host que o servico `RemotoAgent` iniciou e que o processo interativo `RemotoAgent.exe sessions` esta ativo depois do login.
4. Confirme que o host tem FFmpeg acessivel. O agente aceita CPU como padrao; GPU dedicada e aceleracao opcional.
5. No painel, confirme o dispositivo online, solicite uma sessao `game` e aprove-a como owner ou admin.
6. Abra o cliente operador com o descritor de uso unico gerado pelo painel. O descritor e consumido pela API e apagado localmente depois da leitura.

## Matriz minima

| Cenario | Evidencia obrigatoria |
| --- | --- |
| CPU sem GPU dedicada | video H.264, entrada de mouse/teclado e uso de CPU medidos |
| GPU integrada | estabilidade, encoder escolhido e diferenca de latencia |
| GPU dedicada | FPS, bitrate, encoder e temperatura |
| Rede local | RTT, perda, FPS recebido e tempo ate o primeiro frame |
| Internet com HTTPS/WSS | mesma medicao, reconexao e expiracao de sessao |
| Usuario sem permissao de admin | solicitacao registrada e aprovacao bloqueada corretamente |
| Encerramento pelo painel | socket fecha, processo de captura termina e o agente volta a aguardar |
| Bloqueio de tela/UAC | comportamento documentado; nao tratar como compatibilidade garantida |

## Registro

Para cada rodada, guardar data, versao/commit, sistema operacional, CPU, GPU, resolucao, FPS, bitrate, encoder, RTT medio/p95, perda, tempo ate o primeiro frame, uso de CPU/GPU e resultado de cada entrada. Nao habilitar `ENABLE_GAME_MODE=true` em producao antes de haver uma rodada local e uma rodada pela internet com resultado aceitavel.

## Limites conhecidos

- A captura atual usa FFmpeg com `gdigrab` e H.264; a qualidade depende do encoder e da rede.
- O fallback de CPU permite operar sem placa dedicada, mas nao promete 60 FPS em qualquer maquina.
- Jogos com anti-cheat, desktop seguro, UAC ou protecoes de baixo nivel podem bloquear captura ou entrada.
- O modo suporte RustDesk e o modo jogo nativo sao adaptadores diferentes; a aprovacao da sessao continua sendo comum, mas a compatibilidade de jogo nao deve ser inferida a partir de uma sessao de suporte.
