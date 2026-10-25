# Entrega 085 - Comandos de diagnostico operacional

## Entregue

- O painel pode solicitar processos ativos, servicos instalados e um diagnostico resumido.
- O agente executa somente comandos fixos e somente de leitura; nao existe campo de shell ou comando arbitrario.
- Processos sao limitados a 80 itens e servicos a 100 itens para manter a resposta pequena.
- O diagnostico combina sistema, memoria, discos, graficos, captura e runtime sem enviar credenciais.
- A API valida os novos tipos na mesma fila autenticada e auditada dos comandos existentes.

## Limite

Os comandos ainda exibem o status e o resultado no historico da fila; uma tela dedicada para explorar e exportar cada resultado fica para a proxima etapa. Operacoes destrutivas, como reiniciar o host, continuam fora do MVP.
