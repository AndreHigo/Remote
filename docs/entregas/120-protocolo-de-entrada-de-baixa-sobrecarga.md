# Entrega 120 - Protocolo de entrada de baixa sobrecarga

O caminho de teclado e mouse do host Windows agora usa um protocolo textual tipado e compacto entre o agente e a ponte persistente de `SendInput`:

- `m dx dy` para movimento relativo;
- `b botao acao` para botoes;
- `w delta` para roda;
- `k scanCode acao extended` para teclado.

A validação de domínio continua acontecendo antes do envio e a ponte não interpreta comandos arbitrários. A mudança remove o `ConvertFrom-Json` por evento do PowerShell, reduzindo trabalho no caminho sensível à latência sem alterar os limites de segurança ou a liberação automática de entradas quando a sessão termina.

O ganho final de atraso ainda precisa ser medido em duas máquinas Windows e em jogos reais. O protocolo não transforma `SendInput` em XInput/DirectInput e não contorna anti-cheat.
