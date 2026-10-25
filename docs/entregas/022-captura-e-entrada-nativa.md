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

Os modulos ainda nao estao ligados a uma porta publica, relay ou sessao autenticada. Essa separacao e intencional: expor entrada remota antes de fechar autenticacao, expiracao, encerramento e auditoria criaria risco operacional.

## Proxima integracao

1. Criar canal autenticado de sessao com token curto e uso unico.
2. Transportar frames e eventos pelo mesmo contexto de sessao.
3. Associar encerramento do painel ao processo de captura e a ponte de entrada.
4. Medir latencia, perda, FPS e comportamento em jogos reais.
