# Entrega 022 - Fundacao de captura e entrada nativa

## Entregue

- Perfil de captura Windows com FFmpeg e baixa latencia.
- CPU como caminho padrao acessivel.
- Encoders NVIDIA, AMD e Intel como aceleracao opcional.
- Perfis `low`, `balanced`, `high` e `auto` com bitrate/FPS controlados.
- Validacao tipada de movimento, botoes, roda e teclas por scancode.
- Ponte Windows isolada para `SendInput`, sem execucao de comandos arbitrarios.
- Testes unitarios para perfis de video e eventos de entrada.

## Limite atual

O cliente desktop agora consome um token de sessao assinado, com hash no banco, expiracao de cinco minutos e uso unico. Os modulos ainda nao estao ligados a uma porta publica, relay ou transporte de frames. Essa separacao e intencional: expor entrada remota antes de fechar relay, encerramento e auditoria criaria risco operacional.

## Proxima integracao

1. Transportar frames e eventos pelo mesmo contexto de sessao.
2. Associar encerramento do painel ao processo de captura e a ponte de entrada.
3. Criar relay e travessia de NAT com limites de banda.
4. Medir latencia, perda, FPS e comportamento em jogos reais.
