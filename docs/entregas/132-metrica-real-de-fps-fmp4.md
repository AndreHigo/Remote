# Metrica real de FPS no fMP4

## Entrega

Os clientes web e Operator passaram a contar samples de video dos fragmentos `moof/trun` do fMP4. A contagem anterior considerava cada segmento recebido como um quadro, o que subestimava o FPS quando um segmento carregava varios frames.

O relatorio realtime agora preserva `framesReceived` como segmentos recebidos e usa `videoFramesReceived` para calcular `fpsReceived`. O cliente tambem identifica o track de video para nao somar samples de audio quando a sessao tiver audio.

## Validacao

- `30/30` testes do cliente nativo;
- typecheck e build dos workspaces;
- validacao local de release aprovada;
- `npm audit`: zero vulnerabilidades.

Essa correcao melhora a medicao, mas ainda nao substitui a homologacao entre duas maquinas Windows. O host de teste continua sem `REALTIMEURL`, sem a tarefa interativa instalada e com FFmpeg apenas no perfil do usuario, portanto a sessao real ainda precisa ser corrigida no instalador e validada em duas maquinas.
