# Entrega 010 - Fundacao da integracao RustDesk

## Entregue

- agente tenta descobrir o ID real do RustDesk instalado com `--get-id`;
- fallback para ID simulado continua disponivel quando RustDesk nao esta instalado;
- solicitacao de sessao retorna URI `rustdesk://connection/new/<id>` e comando de apoio;
- painel registra a sessao e tenta abrir o cliente RustDesk pelo protocolo do sistema;
- somente owner, admin e technician podem solicitar uma sessao;
- linha externa de Docker separada para `hbbs` e `hbbr`;
- volume persistente para as chaves do servidor RustDesk;
- documentacao das portas, relay e chave publica.
- runner e instalador PowerShell para executar o agente como servico Windows;
- reinicio automatico do servico em falhas.

## Fluxo atual

1. RustDesk roda no dispositivo remoto e esta configurado para o mesmo `hbbs`/`hbbr`.
2. O agente descobre o ID real e envia esse valor para a API.
3. O tecnico clica em `Conectar` no painel.
4. A API grava a solicitacao e a auditoria.
5. O navegador chama `rustdesk://...` para abrir o cliente local do tecnico.

## Validacao

- `npm run typecheck`;
- `npm run build`;
- API continua protegendo a solicitacao por papel;
- stack RustDesk validado estruturalmente com Docker Compose quando Docker estiver disponivel;
- teste real de tela e teclado depende de duas maquinas com RustDesk instalado e servidor acessivel.

## Ainda falta

- instalar RustDesk nas duas maquinas de teste;
- configurar `hbbs`, `hbbr`, DNS, firewall e chave publica;
- substituir o ID simulado dos dados seed por IDs RustDesk reais;
- empacotar o agente e RustDesk em instalador Windows;
- 2FA, rate limit e gerenciamento de chaves pelo painel;
- deploy público com HTTPS, backups e monitoramento.
