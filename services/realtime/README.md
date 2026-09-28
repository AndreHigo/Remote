# Realtime

Servico para eventos em tempo real.

Responsabilidades:

- heartbeat de dispositivos;
- presenca online/offline;
- eventos de solicitacao de acesso;
- notificacoes do painel;
- entrega de comandos ao agente.

Stack candidata:

- WebSocket;
- Redis Pub/Sub ou NATS;
- protocolo com assinatura e expiracao.

