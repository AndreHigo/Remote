# Entrega 097 - Instalador sem arquivo bloqueado

## Entregue

- O instalador por pacote e o reparo encerram a tarefa interativa e os processos do agente antes de recriar os arquivos.
- A reinstalacao espera o Service Control Manager concluir a remocao do servico antes de chamar `New-Service`.
- A desinstalacao tambem aguarda o servico desaparecer, evitando deixar uma remocao pendente.
- O erro agora informa para aguardar e tentar novamente quando o Windows ainda estiver liberando o servico.

## Motivo

O Windows pode manter `RemotoAgent.exe` aberto pela tarefa interativa ou deixar o servico em estado de exclusao por alguns segundos. Nesses momentos o instalador falhava ao substituir o executavel com `Acesso negado`.

## Limite

Uma atualizacao ainda precisa ser homologada em uma maquina Windows com o agente realmente instalado, especialmente durante uma sessao remota ativa. O CI valida os scripts e os artefatos, mas nao substitui esse teste no host.

