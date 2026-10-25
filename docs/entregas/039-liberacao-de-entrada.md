# Entrega 039 - Liberacao de entrada no encerramento

## Entregue

- o bridge Windows acompanha teclas e botoes do mouse pressionados;
- ao encerrar a sessao, ele envia eventos `up` para tudo que ainda estiver pressionado;
- o rastreador e testado de forma independente, incluindo teclas estendidas;
- o encerramento continua idempotente para evitar liberar a mesma entrada duas vezes.

## Por que importa

Uma queda de rede ou encerramento do operador nao deve deixar uma tecla, como `W`, ou um botao do mouse preso no computador remoto. Esta protecao melhora o uso em jogos e suporte sem instalar driver adicional.

## Limite

O mecanismo cobre teclado e mouse. Gamepad, audio e homologacao entre duas maquinas Windows continuam dependentes de suporte do host e de testes externos.
