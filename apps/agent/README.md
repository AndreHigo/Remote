# Agent

Agente instalado no dispositivo remoto.

Responsabilidades:

- registrar dispositivo;
- enviar heartbeat;
- coletar inventario;
- coletar identidade forte da maquina;
- executar comandos permitidos;
- exibir solicitacao de acesso assistido;
- integrar com motor de acesso remoto.

Stack candidata:

- Rust ou Go;
- servico Windows;
- atualizacao assinada;
- logs locais limitados e rotativos.

## CLI simulado

Enquanto o agente nativo nao existe, este workspace oferece um simulador em Node/TypeScript.

```bash
npm run agent:register
npm run agent:heartbeat
npm run agent:inventory
npm run agent:commands
npm run agent:loop
```

Para preparar uma configuracao local ignorada pelo Git:

```bash
npm run agent:config:init
npm run agent:status
```

O arquivo `.remoto-agent.config.json` fica local ao agente e nunca deve ser versionado. A chave tambem pode continuar sendo fornecida por `REMOTO_AGENT_KEY`, que tem prioridade sobre o arquivo.

Variaveis opcionais:

```text
REMOTO_API_URL=http://localhost:4100
REMOTO_AGENT_KEY=REMOTO-DEMO-AGENT-KEY
REMOTO_AGENT_TAGS=teste,windows
REMOTO_AGENT_HEARTBEAT_SECONDS=30
REMOTO_AGENT_COMMAND_SECONDS=10
REMOTO_AGENT_INVENTORY_SECONDS=300
REMOTO_AGENT_CONFIG=.remoto-agent.config.json
REMOTO_AGENT_STATE=.remoto-agent.json
```

Identidade coletada no simulador:

- serial BIOS, quando disponivel;
- UUID do sistema, quando disponivel;
- MAC principal;
- hash de identidade derivado dos sinais disponiveis.
