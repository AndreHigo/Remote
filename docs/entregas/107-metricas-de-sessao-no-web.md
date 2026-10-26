# Entrega 107 - Metricas de sessao no navegador

O modo jogo no navegador agora exibe, durante uma sessao ativa:

- ultimo RTT medido pelos pings do relay;
- p95 dos ultimos 60 samples de RTT;
- tempo ate o primeiro frame binario recebido;
- FPS recebido no ultimo segundo;
- quantidade de frames descartados quando a fila local ultrapassa o limite de 16 MB.

Essas metricas sao observabilidade da sessao do navegador. O RTT nao equivale sozinho ao atraso fim a fim de um comando dentro do jogo, e os valores nao substituem homologacao em duas maquinas, medicao de perda, uso de CPU/GPU ou compatibilidade por jogo.
