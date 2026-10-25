# Entrega 048 - Diagnostico automatico de homologacao

## O que foi entregue

O script `scripts/homologate-host.ps1` coleta um retrato tecnico da maquina Windows sem ler a chave do agente, tokens ou URLs privadas. Ele acompanha o pacote Windows do agente e registra:

- sistema operacional, CPU, memoria e adaptadores de video;
- caminho e disponibilidade do FFmpeg;
- diferenca entre o FFmpeg encontrado no perfil do usuario e o executavel em caminho protegido que o servico pode usar;
- encoders H.264 de GPU publicados pela build;
- disponibilidade de `ddagrab` e `gdigrab`;
- indicacao de DirectShow e do estado de audio que ainda exige homologacao;
- estado do servico `RemotoAgent`, da tarefa de logon e do processo interativo `RemotoAgent.exe sessions`;
- presenca da configuracao instalada, sem imprimir API, relay ou chave, e indicacao objetiva quando algum campo obrigatorio esta ausente;
- proximos testes obrigatorios da matriz de jogo.

## Uso

No computador Windows que sera homologado:

```powershell
npm run diagnostics:host -- -OutputPath "$env:USERPROFILE\Desktop\remoto-host-report.json"
```

Ou para apenas imprimir o JSON:

```powershell
npm run diagnostics:host
```

O arquivo pode ser anexado ao registro da rodada junto com o commit, RTT, FPS, perda, tempo ate o primeiro frame e resultado dos testes de entrada. O diagnostico nao substitui uma sessao entre duas maquinas.

## Audio

O diagnostico nao afirma que `wasapi` esta disponivel apenas porque o Windows usa WASAPI. O FFmpeg comum normalmente oferece `dshow`, que depende de um dispositivo de captura DirectShow; captura loopback de audio do desktop precisa de um componente nativo separado ou de um dispositivo loopback validado. Ate essa etapa, o modo jogo permanece video-only quando nao houver um caminho de audio comprovado.
