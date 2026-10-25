# Entrega 035 - Atualizacao segura do agente Windows

## Entregue

- o Inno Setup fecha aplicacoes conhecidas antes de copiar os arquivos;
- `PrepareToInstall` para o servico antes da fase de substituicao;
- o instalador aguarda o servico, encerra o host do servico e o processo interativo;
- a desinstalacao usa a mesma ordem e aguarda os processos antes de remover o servico;
- o pacote Windows foi recompilado e validado pelo compilador do Inno Setup;
- SHA256 atual: `DA705B9562BA85B9B4DA9EB28A737DAD437B84A9B61A108D357A7475B9DCD254`.

## Limite

O fechamento foi validado por compilacao e inspeção do fluxo do instalador. Ainda falta executar uma atualizacao real em outra maquina Windows com o servico e o processo desktop ativos, porque esse cenario depende do ambiente externo.
