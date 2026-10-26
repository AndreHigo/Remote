# Entrega 109 - Preflight de producao endurecido

O preflight da VPS agora valida tambem:

- formato do email usado pelo ACME;
- hostname do dominio web e do relay RustDesk, sem protocolo, porta ou caminho;
- origens realtime HTTPS explicitas, sem curinga, credenciais ou caminhos, incluindo obrigatoriamente `https://WEB_DOMAIN`;
- ausencia de reutilizacao entre senha do PostgreSQL, chave de backup, segredos da API/relay e senha inicial do owner.

Essas verificacoes acontecem antes do `docker compose config` e reduzem o risco de subir a stack com CORS permissivo, dominio malformado ou uma unica credencial reutilizada em varios componentes.

O preflight continua dependendo de um `production.env` real e de uma VPS/Docker para confirmar DNS, ACME, Redis TLS, migracoes e disponibilidade da infraestrutura.
