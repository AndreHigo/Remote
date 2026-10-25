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

## Agente local e instalador Windows

O workspace oferece o agente local em Node/TypeScript e um instalador Windows que o registra como servico. O servico faz registro, heartbeat, inventario e comandos permitidos; um processo desktop do mesmo agente inicia no login do usuario e consulta sessoes de jogo aprovadas na sessao interativa, onde captura e `SendInput` podem acessar a area de trabalho correta. O transporte de captura do host usa o modulo realtime do desktop-control.

O instalador pede a URL da API, a URL publica do relay (`wss://dominio/realtime`) e a chave de cadastro. O caminho do `ffmpeg.exe` e opcional: informe-o quando o FFmpeg estiver instalado fora do PATH ou deixe em branco para a descoberta automatica. Em uma instalacao local, use `http://localhost:4100` e `ws://localhost:4200`; fora de loopback, o agente exige `https://` na API e `wss://` no relay e rejeita credenciais embutidas. Em producao, nunca deixe o relay apontando para `localhost`.

```bash
npm run agent:register
npm run agent:heartbeat
npm run agent:inventory
npm run agent:commands
npm run agent:loop
npm run agent:service:install
npm run agent:service:uninstall
```

Em desenvolvimento, `agent:service:install` tambem registra o processo `sessions` no login do usuario. O servico nao abre captura de jogo em Session 0.

Para preparar uma configuracao local ignorada pelo Git:

```bash
npm run agent:config:init
npm run agent:status
```

O arquivo `.remoto-agent.config.json` fica local ao agente e nunca deve ser versionado. A chave tambem pode continuar sendo fornecida por `REMOTO_AGENT_KEY`, que tem prioridade sobre o arquivo.

No instalador Windows, a configuracao e somente leitura para o usuario que instalou o agente e o estado operacional fica em `C:\ProgramData\Remoto\state`. O processo desktop e registrado no autostart do Windows; somente o usuario com ACL de leitura consegue iniciar o fluxo, e a credencial do agente deve ser revogada no painel quando o computador for desativado.

Durante uma atualizacao, o instalador para o servico e encerra os hosts do agente antes de substituir os executaveis. Se uma instancia antiga estiver presa por software de seguranca, o instalador registra a falha em seu log e deve ser executado novamente depois que o processo for liberado.

Variaveis opcionais:

```text
REMOTO_API_URL=http://localhost:4100
REMOTO_REALTIME_URL=ws://localhost:4200
REMOTO_AGENT_KEY=<chave gerada no painel>
REMOTO_AGENT_TAGS=teste,windows
REMOTO_AGENT_HEARTBEAT_SECONDS=30
REMOTO_AGENT_COMMAND_SECONDS=10
REMOTO_AGENT_INVENTORY_SECONDS=300
REMOTO_AGENT_CONFIG=.remoto-agent.config.json
REMOTO_AGENT_STATE=.remoto-agent.json
REMOTO_CAPTURE_QUALITY=auto
REMOTO_CAPTURE_ENCODER=auto
REMOTO_CAPTURE_METHOD=auto
REMOTO_CAPTURE_WIDTH=1920
REMOTO_CAPTURE_HEIGHT=1080
REMOTO_CAPTURE_FPS=60
REMOTO_CAPTURE_BITRATE_KBPS=8000
```

Os parametros de captura sao opcionais. O padrao `auto` escolhe uma aceleracao H.264 disponivel (NVIDIA, AMD ou Intel) e cai para `libx264` por CPU quando nao houver GPU compativel. Use `low` para maquinas limitadas, `balanced` para uso geral ou `high` quando a rede e o hardware suportarem. Um encoder explicito tambem cai para CPU se a build local do FFmpeg nao oferecer aquele encoder.

O metodo de captura pode ser `auto`, `ddagrab` ou `gdigrab`. Em `auto`, o agente usa o Desktop Duplication API (`ddagrab`) quando a build do FFmpeg oferece o filtro, melhorando a compatibilidade com jogos em tela cheia, e cai para `gdigrab` quando necessario.

Identidade coletada pelo agente:

- serial BIOS, quando disponivel;
- UUID do sistema, quando disponivel;
- MAC principal;
- hash de identidade derivado dos sinais disponiveis.
