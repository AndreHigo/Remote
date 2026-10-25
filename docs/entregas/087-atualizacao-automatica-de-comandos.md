# Entrega 087 - Atualizacao automatica de comandos

## Entregue

- O painel continua consultando os comandos do dispositivo selecionado a cada quatro segundos.
- Resultados que chegam depois do enfileiramento aparecem sem exigir refresh manual.
- Falhas temporarias durante a consulta nao apagam o ultimo resultado visivel.
- A consulta e cancelada quando o operador troca de dispositivo ou sai da tela.

## Limite

O intervalo ainda e fixo e nao usa WebSocket de notificacao; o resultado pode levar ate quatro segundos para aparecer. A execucao continua dependendo do agente instalado e online.
