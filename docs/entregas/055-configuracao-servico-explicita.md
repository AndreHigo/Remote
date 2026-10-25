# Entrega 055: configuracao explicita do servico

## O que foi feito

- O processo instalado como servico agora exige `apiUrl` e `realtimeUrl` no arquivo de configuracao ou nas variaveis `REMOTO_API_URL` e `REMOTO_REALTIME_URL`.
- O modo de desenvolvimento continua podendo usar `http://localhost:4100` e `ws://localhost:4200` automaticamente.
- A validacao ocorre antes do registro e do heartbeat, evitando que um agente instalado tente conversar com o proprio computador quando a configuracao do relay ficou incompleta.
- O comportamento de servico, desenvolvimento e sobrescrita por ambiente ganhou testes automatizados.

## Impacto no instalador

O arquivo instalado precisa conter, no minimo:

```json
{
  "apiUrl": "https://api.exemplo.com",
  "realtimeUrl": "wss://relay.exemplo.com",
  "agentKey": "chave-gerada-no-painel"
}
```

Em uma instalacao local, os enderecos `localhost` continuam validos. Em uma VPS, use HTTPS/WSS com os dominios publicos e o proxy TLS configurado.

## Falta para homologar

- Reinstalar o pacote atualizado em uma maquina Windows com permissao administrativa.
- Confirmar no diagnostico que o servico aponta para os enderecos publicos e que o processo interativo abre a sessao.
