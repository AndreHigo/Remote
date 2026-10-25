# Entrega 098 - Reconexao do operador nativo

## Entregue

- O operador nativo agora tenta reconectar por uma janela maior, com backoff de 500 ms ate 15 s e 12 tentativas.
- Depois do limite, a sessao nao e descartada silenciosamente: a janela oferece `Tentar novamente`.
- Encerramento administrativo, expiracao, revogacao e token invalido continuam sendo motivos terminais sem retry automatico.
- A politica de backoff foi extraida para um modulo testavel e coberta por testes do operador.

## Limite

O retry melhora a tolerancia a quedas temporarias, mas nao mede nem garante qualidade de internet. A homologacao ainda precisa registrar perda, RTT, tempo de recuperacao e comportamento durante um jogo real em duas maquinas.

