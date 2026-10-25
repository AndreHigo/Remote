# Entrega 054 - FFmpeg protegido no instalador

## O que foi entregue

O instalador Windows aceita um caminho opcional para `ffmpeg.exe`. Quando o arquivo esta no perfil do usuario ou em outro local mutavel, a instalacao elevada copia o executavel para `ffmpeg\ffmpeg.exe` dentro da pasta protegida do Remoto e grava esse caminho na configuracao do agente.

O servico continua impedido de executar diretamente um binario de perfil. A desinstalacao remove a copia protegida junto com o agente. O diagnostico de homologacao agora separa:

- FFmpeg encontrado no ambiente do usuario;
- FFmpeg disponivel em caminho protegido para o servico;
- caso em que so existe a copia do perfil e a instalacao ainda precisa ser reparada.

## Validacao

- scripts PowerShell analisados pelo parser sem erros;
- diagnostico local confirmou `userProfileFfmpegOnly=true` na maquina atual;
- CI Windows valida empacotamento, diagnostico e scripts do instalador.

## Limites

O instalador ainda nao baixa uma distribuicao FFmpeg automaticamente. O usuario precisa fornecer um executavel existente ou instalar uma distribuicao confiavel. Audio WASAPI, homologacao entre duas maquinas e desempenho real continuam gates separados.
