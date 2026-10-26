# Entrega 099 - Limpeza de handshake realtime

## Entregue

- Falhas de handshake agora encerram explicitamente o WebSocket em vez de apenas rejeitar a Promise.
- `cleanup()` ficou idempotente, evitando fechar duas vezes a ponte de entrada ou o processo de captura.
- O transporte ganhou teste de regressao para mensagem de controle invalida e confirma o fechamento do socket do servidor.

## Motivo

Uma resposta realtime malformada ou inesperada nao deve deixar conexao, timer ou processo auxiliar ativo. Isso e especialmente importante no modo jogo, em que o agente pode estar capturando a tela e mantendo entrada remota aberta.

## Limite

O teste valida o ciclo de vida local do transporte. Quedas reais de rede, reconexao entre maquinas e comportamento do sistema operacional continuam exigindo homologacao externa.

