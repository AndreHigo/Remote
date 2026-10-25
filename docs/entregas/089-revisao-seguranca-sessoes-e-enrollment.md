# Entrega 089 - Revisao de seguranca de sessoes e enrollment

## Entregue

- Uma chave de enrollment nova nao pode reassociar um dispositivo existente apenas porque um campo de identidade foi copiado.
- Inventario de dispositivos arquivados nao e mais retornado pela rota operacional.
- Logout, ativacao/desativacao de 2FA e revogacao de chave invalidam sessoes no banco e solicitam o fechamento do relay.
- O instalador remove o perfil baixado que contem a chave bearer depois de instalar o agente com sucesso.

## Limites

- A identidade de hardware continua sendo uma evidencia informada pelo agente, nao uma atestacao criptografica.
- A revogacao do relay permanece dependente da disponibilidade do endpoint interno; a revalidacao do relay segue como fallback.
- O operador nativo ainda precisa de um mecanismo de endpoint confiavel para nao aceitar URLs alteradas em um descritor local.
