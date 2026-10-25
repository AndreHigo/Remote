# Entrega 021 - Acessibilidade de hardware

## Decisao de produto

O Remoto sera apresentado como um unico aplicativo. O usuario nao precisa conhecer RustDesk, Sunshine, Moonlight, codecs ou protocolos. A aplicacao tera modos Host e Cliente e selecionara automaticamente a melhor estrategia disponivel.

## Perfis de capacidade

- **GPU dedicada:** prioriza codificacao acelerada e maior qualidade.
- **GPU integrada:** permitida; prioriza H.264 e qualidade adaptativa.
- **Sem aceleracao utilizavel:** fallback de CPU, com FPS e resolucao reduzidos quando necessario.
- **Cliente sem GPU dedicada:** permitido quando houver decodificacao integrada ou CPU suficiente.

## Entregue nesta etapa

- O agente coleta adaptadores de video, memoria aproximada, driver e modo de codificacao possivel no Windows.
- O painel exibe o hardware de video e informa se existe fallback de CPU.
- A documentacao do desktop-control fixa a regra de um unico aplicativo e instalador.
- A captura Windows usa `gdigrab` com `libx264` por CPU como padrao e encoders NVIDIA/AMD/Intel como aceleracao opcional.
- O instalador e o agente descobrem FFmpeg em caminhos comuns do Windows, incluindo WinGet, sem exigir placa de video dedicada.
- O transporte local foi exercido com FFmpeg/CPU e os bytes enviados ao relay possuem teste automatizado.
- O agente aceita perfil de qualidade, encoder, dimensao, FPS e bitrate por arquivo de configuracao ou variavel de ambiente, mantendo CPU/auto como padrao.

## Ainda falta

- Medir FPS e latencia por perfil.
- Evoluir os perfis configuraveis para fallback adaptativo baseado em RTT, fila e perda observados.
- Testar com computador com GPU dedicada, video integrado e sem aceleracao utilizavel.
