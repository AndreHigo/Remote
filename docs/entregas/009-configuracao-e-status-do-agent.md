# Entrega 009 - Configuracao e status operacional do agente

## Entregue

- arquivo local de configuracao do agente, separado do codigo versionado;
- comando `agent:config:init` para criar a configuracao sem sobrescrever arquivo existente;
- comando `agent:status` com diagnostico da API, chave configurada, estado local e status do dispositivo;
- variaveis de ambiente continuam funcionando e tem prioridade sobre o arquivo;
- estado do dispositivo e configuracao local sao gravados em arquivos ignorados pelo Git;
- endpoint autenticado `GET /agent/devices/:id/status`;
- heartbeat e inventario do agente agora validam o `customerId` associado a chave;
- registro por identidade forte tambem fica limitado ao cliente da chave;
- nenhum endpoint de agente altera dispositivo de outro cliente usando apenas um ID ou identidade de hardware.

## Como usar

```bash
npm run agent:config:init
npm run agent:status
npm run agent:register
npm run agent:loop
```

Depois de `config:init`, preencher `agentKey` com uma chave ativa do cliente. Em ambiente local, a chave seed continua disponivel no README; em ambiente real ela deve ser criada por um fluxo administrativo e rotacionada.

## Validacao prevista

- `npm run typecheck`;
- `npm run build`;
- `npm run agent:status` com API disponivel;
- heartbeat, inventario e comandos usando a configuracao local;
- tentativa de status com dispositivo de outro cliente deve retornar `404`.

## Ainda falta

- criar chave de agente por cliente dentro do painel;
- revogacao e rotacao de chaves com historico;
- instalador e servico Windows real;
- logs locais rotativos e atualizacao assinada;
- agente nativo em Rust ou Go;
- integrar o canal de acesso remoto RustDesk.
