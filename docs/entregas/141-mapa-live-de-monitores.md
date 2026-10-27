# Entrega 141 - Mapa live de monitores

## O que foi corrigido

- O navegador não depende mais somente do inventário antigo para montar as abas de monitor.
- O agente publica no relay os monitores detectados no início da sessão.
- O relay guarda o mapa e o entrega ao operador mesmo quando ele entra depois do agente.
- A aba ativa acompanha o monitor real usado pelo host, inclusive quando a tela principal não é o índice zero.

## Diagnóstico do caso

O computador tinha dois monitores no Windows, mas o último inventário salvo tinha apenas `WinDisc`. Por isso a sessão mostrava uma única aba. O vídeo estava conectado e o primeiro frame só demorou alguns segundos para chegar; não era uma sessão sem acesso.

## Pendência operacional

O agente instalado precisa ser atualizado uma vez para enviar o mapa live. Depois disso, novas sessões devem mostrar as telas detectadas na hora da conexão. A atualização do agente encerra a sessão ativa durante a troca do serviço.
