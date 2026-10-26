# Entrega 114 - Relatorio no operador nativo

O operador Windows agora permite salvar um relatorio JSON da sessao de jogo pelo botao `Salvar relatorio`.

O arquivo registra:

- identificadores da sessao e do dispositivo, sem o token de acesso;
- duracao, primeiro frame, FPS atual, frames e bytes recebidos;
- RTT atual, p95 e amostras recentes;
- descartes da fila local e do relay;
- reconexoes observadas pelo operador.

O caminho e escolhido pelo dialogo nativo do Windows. O relatorio e limitado, sanitizado e pode ser anexado ao runbook de homologacao junto com CPU, GPU, jogo, resolucao e rede usada.
