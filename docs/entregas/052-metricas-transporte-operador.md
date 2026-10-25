# Entrega 052 - Metricas do transporte no operador

## O que entrou

- o cliente nativo registra quantos frames e bytes recebeu;
- o primeiro frame mede o tempo desde a autenticacao realtime;
- o RTT continua sendo medido pelos pings do relay;
- o operador conserva uma janela de amostras e exibe RTT atual e p95;
- as metricas sao consolidadas no maximo uma vez por segundo para nao transformar diagnostico em carga de IPC;
- a janela do operador exibe FPS, RTT, tempo ate o primeiro frame e volume recebido.
- o player limita o buffer de video a uma janela curta, reposiciona no live edge quando o atraso cresce e contabiliza frames descartados da fila.

## Evidencia

O teste de integracao de `apps/desktop-control` agora valida a entrega dos frames, a entrada tipada e as metricas acumuladas do cliente. A medicao e observabilidade de uma sessao real entre duas maquinas continuam dependendo do runbook de homologacao.

## Limites

Essas metricas nao estimam sozinhas a latencia perceptivel do jogo: elas nao medem o tempo do encoder, a apresentacao do frame no monitor, a perda no caminho antes do relay ou a resposta do jogo. Para isso, ainda e necessario executar a matriz de duas maquinas em rede local e internet.
