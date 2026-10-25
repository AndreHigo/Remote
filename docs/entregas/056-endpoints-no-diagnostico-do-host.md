# Entrega 056: endpoints no diagnostico do host

## O que foi feito

- O `homologate-host.ps1` agora registra o protocolo, host, porta e caminho da API configurada.
- O mesmo relatorio registra o protocolo, host, porta e caminho do relay realtime.
- A chave do agente continua sem ser impressa ou incluida no relatorio.
- URLs invalidas aparecem como `invalid`, sem interromper a coleta das demais evidencias.

## Por que isso importa

Um agente pode ter `apiUrl` e `realtimeUrl` preenchidos e ainda apontar para `localhost`, uma porta antiga ou um caminho de proxy incorreto. O diagnostico passa a mostrar o destino efetivo para diferenciar falha de instalacao, DNS/TLS, API e relay.

## Validacao

- O script continua sendo validado pelo CI como PowerShell parseavel.
- O smoke local foi executado com sucesso para API, Postgres, agente, sessao de jogo e relay.

O relatorio ainda nao substitui a instalacao elevada e o teste entre duas maquinas Windows.
