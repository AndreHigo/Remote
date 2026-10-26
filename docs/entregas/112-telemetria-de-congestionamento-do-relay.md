# Entrega 112 - Telemetria de congestionamento do relay

O relay realtime agora informa ao cliente autenticado quando precisou descartar frames por excesso de buffer.

- os descartes sao acumulados por sessao;
- frames e bytes sao reportados em uma mensagem de telemetria limitada a uma atualizacao por segundo;
- o painel web e o operador nativo exibem o contador separado da fila local;
- o relatorio JSON da sessao inclui os dois sinais para diferenciar congestionamento no relay de atraso no renderer.

Essa telemetria nao transforma WebSocket em transporte sem perda nem mede perda de pacotes IP diretamente. Ela registra somente descartes que o proprio relay confirmou, preservando a honestidade da medicao.
