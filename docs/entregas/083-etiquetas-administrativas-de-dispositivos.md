# Entrega 083 - Etiquetas administrativas de dispositivos

## Entregue

- Owner e admin podem editar etiquetas do computador no detalhe do dispositivo.
- A busca do painel encontra o dispositivo por nome, cliente, IP, sistema ou etiqueta.
- Etiquetas repetidas sao removidas sem diferenciar maiusculas e minusculas; o limite e de 20 etiquetas com 40 caracteres cada.
- O recadastro do agente preserva etiquetas administrativas e apenas acrescenta etiquetas tecnicas novas.
- A alteracao gera o evento `device.tags.updated` na auditoria.

## Validacao

- Testes da normalizacao de etiquetas.
- Typecheck da API e do painel.
- `git diff --check` sem erros.

## Limite

As etiquetas sao o primeiro nivel de agrupamento operacional. Ainda nao existe uma entidade de grupos com politicas proprias, memberships por cliente ou permissao granular por etiqueta.
