# Entrega 110 - Rotacao segura de backups

Foi adicionada uma rotina operacional para controlar a retencao dos backups cifrados do PostgreSQL.

- a simulacao e o comportamento padrao e lista os arquivos candidatos sem apagar nada;
- a quantidade retida e configuravel, com padrao de 7 arquivos;
- a remocao exige `-ConfirmDelete` explicitamente;
- somente arquivos no formato `remoto-YYYYMMDD-HHmmss.sql.enc` sao considerados;
- o script foi incluido na validacao sintatica do CI e pode ser chamado por `npm run backup:rotate`.

Isso cobre a rotina local de retencao, mas a politica final da VPS ainda precisa definir onde os backups serao copiados, quanto tempo serao mantidos fora do servidor e como sera feita a restauracao periodica de teste.
