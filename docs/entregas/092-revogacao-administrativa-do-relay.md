# Entrega 092 - Revogacao administrativa do relay

## Entregue

- Redefinir senha fecha as sessoes realtime do usuario.
- Arquivar, mover ou excluir um computador fecha as sessoes realtime vinculadas.
- A resposta HTTP nao expõe os IDs internos usados apenas para fechar o relay.
- A revalidacao periodica do relay continua como fallback quando o endpoint interno estiver indisponivel.
