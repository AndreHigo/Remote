# 126 - Limite do download publico do instalador

## Entregue

- O endpoint publico `/downloads/agent` continua sem exigir login para funcionar como link direto do onboarding.
- O download agora aceita no maximo 30 requisicoes por IP em 15 minutos.
- O contador usa Redis em producao e o mesmo fallback local dos demais limites em desenvolvimento.
- O endpoint devolve os cabecalhos `RateLimit-InstallerDownload-*` e `Retry-After` quando excedido.

## Motivo

O instalador precisa ser baixavel pelo navegador sem transportar o token da sessao na URL, mas nao deve ficar aberto a consumo ilimitado por uma origem. O limite reduz abuso sem mudar o cadastro de computadores.
