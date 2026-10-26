# Entrega 108 - Instalador aborta com arquivo bloqueado

O instalador Inno Setup agora verifica o encerramento do servico, da tarefa interativa e dos processos do agente antes de substituir os executaveis. Se o Windows mantiver `RemotoAgent.exe` ou `RemotoAgentService.exe` aberto, o instalador aborta com uma mensagem orientando executar o reparo como administrador, em vez de prosseguir ate um erro generico de `DeleteFile failed; code 5`.

O preflight local passou a verificar a presenca de `CloseApplications=force`, da funcao de encerramento com retorno e da mensagem de falha. A compilacao do Inno Setup foi executada com sucesso usando o staging atual.

Isso reduz o erro observado durante atualizacao, mas nao substitui a homologacao em uma maquina Windows com o servico e o processo interativo realmente ativos, antivirus e uma versao anterior instalada.
