# Entrega 050 - Limites de payload operacional

## O que mudou

A API passou a limitar dados de operações autenticadas que poderiam crescer sem necessidade:

- o motivo de uma sessão remota aceita no máximo 500 caracteres;
- chaves de payload de comando aceitam no máximo 80 caracteres;
- o payload de comando aceita no máximo 32 KB;
- a validação continua ocorrendo antes de criar registros no banco.

Isso reduz abuso de armazenamento e custo de auditoria sem alterar os três comandos permitidos do agente (ping, system-info e refresh-inventory).

## Validacao

Os testes de segurança e o typecheck da API passaram. A homologacao de producao continua exigindo rate limit distribuido, monitoramento e backup do banco.
