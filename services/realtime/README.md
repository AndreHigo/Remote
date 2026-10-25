# Realtime

Relay WebSocket autenticado para sessoes remotas.

Responsabilidades:

- autenticar os papeis `host` e `client` por token curto;
- encaminhar frames H.264 fragmented MP4 do host para o cliente;
- encaminhar somente eventos de entrada tipados do cliente para o host;
- limitar origem, payload, papeis duplicados e tempo de vida da sala;
- fechar a sala quando o token expirar ou um peer desconectar.

## Configuracao

- `REALTIME_PORT`: porta HTTP/WebSocket, padrao `4200`;
- `REALTIME_API_URL`: URL interna da API para autorizar o canal;
- `REALTIME_INTERNAL_SECRET`: segredo compartilhado somente entre relay e API;
- `REALTIME_ALLOWED_ORIGINS`: origens web separadas por virgula;
- `REALTIME_MAX_FRAME_BYTES`: limite de cada frame binario;
- `REALTIME_MAX_BUFFERED_BYTES`: limite de fila por cliente antes de descartar frames;
- `REALTIME_MAX_PENDING_HANDSHAKES`: limite de autenticacoes simultaneas por endereco.

A API usa `POST /internal/sessions/{id}/close` com `X-Realtime-Secret` para encerrar imediatamente uma sessao administrativa. Essa rota nao e publica e retorna `404` quando a sala nao esta ativa.

O servico nao deve ser exposto diretamente na internet sem proxy TLS. Na stack de producao, o Caddy publica `/realtime/*` e o agente usa a URL publica `wss://dominio/realtime`.

