# 061 - Smoke com primeiro frame real

## Entregue

O smoke local agora sobe o host do agente e um cliente realtime independente. O cliente autentica a sessao aprovada, aguarda um frame binario e falha se o primeiro frame nao chegar em 20 segundos.

Com isso, a validacao local cobre:

- API, banco e autorizacao do canal;
- cadastro, heartbeat e inventario do agente;
- captura FFmpeg no host Windows;
- transporte pelo relay realtime;
- recebimento do primeiro frame pelo cliente.

## Limite conhecido

O primeiro frame nao prova sozinho teclado, mouse, RTT, perda, reconexao, audio, gamepad, UAC, bloqueio de tela ou compatibilidade com jogos protegidos. Esses itens continuam exigindo homologacao com dois computadores Windows.
