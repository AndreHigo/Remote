# Entrega 049 - Autostart interativo consistente

## O que mudou

O instalador de desenvolvimento (agent:service:install) agora usa a mesma estrategia do pacote Windows oficial:

- o servico continua responsavel por heartbeat, inventario e comandos em Session 0;
- a captura de jogo roda como RemotoAgent.exe sessions na sessao interativa do usuario;
- o processo interativo e iniciado por uma tarefa agendada no logon, com nivel limitado;
- instalacoes antigas que usavam HKCU\Software\Microsoft\Windows\CurrentVersion\Run sao removidas;
- a desinstalacao remove a tarefa agendada e a entrada legada.

Se o modulo ScheduledTasks nao estiver disponivel, o script mantem um fallback legado explicito para o autostart do usuario.

## Validacao

O CI faz parsing dos scripts de instalacao oficial, desinstalacao e desenvolvimento. A criacao real da tarefa ainda deve ser confirmada no Windows da homologacao, junto com a presenca do processo interativo e a abertura de uma sessao de jogo.
