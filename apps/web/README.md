# Web App

Painel online da plataforma e cliente web experimental do modo jogo.

Responsabilidades:

- login e 2FA;
- organizacoes, clientes e usuarios;
- dispositivos e grupos;
- status online/offline;
- solicitar e aprovar acesso remoto;
- abrir suporte por RustDesk;
- reproduzir o relay H.264 do modo jogo experimental com teclado e mouse;
- inventario, comandos e auditoria;
- chamados e relatorios em fases futuras.

Stack atual:

- React 18;
- Vite;
- CSS local;
- WebSocket e Media Source Extensions para o modo jogo.

O modo jogo permanece desabilitado por padrao e so aparece como disponivel quando a API responde `gameMode: "experimental"` em `/health`.

