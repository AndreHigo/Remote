# Entrega 138 - Acesso remoto web real

## O que foi entregue

- O modo de suporte deixou de retornar um descritor RustDesk e passou a usar o relay realtime do Remoto.
- O agente desktop conecta sessoes aprovadas nos modos suporte e jogo.
- O navegador recebe video H.264 por MediaSource e envia teclado/mouse pelo mesmo canal autenticado.
- A sessao exibe abas dos monitores detectados; o operador pode trocar a tela durante o acesso sem encerrar a sessao.
- O painel oferece um comando explicito para ativar o foco de teclado e mouse no video.
- O fluxo local foi validado com o computador `DESKTOP-DB26883`: primeiro quadro recebido, 30 FPS, RTT de 1 ms e p95 de 2 ms.

## Fluxo atual

1. O operador solicita acesso em **Dispositivos**.
2. Um owner ou administrador aprova em **Atividade**.
3. O operador escolhe **Abrir no navegador**.
4. O agente conecta como host, captura a area de trabalho e encaminha os quadros pelo relay.
5. O navegador exibe o desktop, envia eventos de teclado e mouse e permite alternar entre as abas de monitor.

## Ainda pendente antes da VPS

- Atualizar o agente instalado em cada computador com o novo instalador.
- Validar duas redes externas com API e relay publicados em HTTPS/WSS.
- Testar jogos e anti-cheat individualmente; o transporte nao promete compatibilidade universal com drivers protegidos.
- Validar a troca em uma maquina com dois monitores reais e confirmar captura por `ddagrab` quando disponivel.
- Assinar o instalador e configurar atualizacao segura.
