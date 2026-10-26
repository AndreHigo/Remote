# Entrega 111 - Relatorio de qualidade da sessao

O modo jogo web passou a exportar um relatorio JSON durante a sessao.

O arquivo inclui:

- RTT e p95 por amostra;
- FPS observado por segundo;
- tempo ate o primeiro frame;
- reconexoes do cliente web;
- frames descartados pela fila local;
- identificadores da sessao e do dispositivo.

O relatorio e uma evidência de observabilidade do operador. Ele nao mede sozinho perda de pacotes no transporte nem substitui a homologacao em duas maquinas, mas torna comparaveis os testes de LAN, internet, CPU e GPU.
