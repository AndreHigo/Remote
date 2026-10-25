# Entrega 025 - Relay integrado e instalavel Windows

## Entregue

- Teste de integracao do relay com dois clientes WebSocket concorrentes.
- Verificacao de frame binario host para cliente.
- Verificacao de teclado tipado cliente para host.
- Verificacao de papel duplicado e aviso de desconexao.
- Validacao de `Origin` configuravel no WebSocket.
- Encerramento gracioso do relay e limpeza de salas.
- Empacotamento Windows compila `desktop-control` antes do agente.
- Host do servico aguarda o processo do agente terminar antes de liberar o executavel em atualizacoes.
- Instalador persiste o caminho de FFmpeg encontrado para o servico, com fallback por `REMOTO_FFMPEG_PATH` e locais comuns do Windows.
- Instalador Inno Setup gerado localmente com sucesso em `apps/agent/release/RemotoAgent-Setup.exe`.

## Validacao executada

```powershell
npm run typecheck
npm run test -w services/realtime
npm run agent:package:windows
```

O instalador foi compilado nesta maquina, mas a instalacao/atualizacao em uma segunda maquina ainda precisa ser exercida com permissao administrativa e agente apontando para uma API real.

Foi feita uma captura local manual com FFmpeg/CPU por quatro segundos, produzindo aproximadamente 2 MB de fragmentos MP4. A captura entre duas maquinas e a medicao de latencia real continuam pendentes.
