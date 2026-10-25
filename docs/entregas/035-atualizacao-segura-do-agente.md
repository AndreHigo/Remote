# Entrega 035 - Atualizacao segura do agente Windows

## Entregue

- o Inno Setup fecha aplicacoes conhecidas antes de copiar os arquivos;
- `PrepareToInstall` para o servico antes da fase de substituicao;
- o instalador aguarda o servico, encerra o host do servico e o processo interativo;
- o pacote Windows foi recompilado e validado pelo compilador do Inno Setup;
- SHA256 atual: `E9AD4BCF604978474552869829F15BAB1F70145F2BE3745B1364350F64C90B21`.

## Limite

O fechamento foi validado por compilacao e inspeção do fluxo do instalador. Ainda falta executar uma atualizacao real em outra maquina Windows com o servico e o processo desktop ativos, porque esse cenario depende do ambiente externo.
