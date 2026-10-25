# Entrega 020 - Fundacao do modo jogo

## Entregue

- `RemoteSession` agora registra o modo `support` ou `game`.
- O painel permite escolher o modo ao solicitar acesso.
- Auditoria e listagem exibem o modo escolhido.
- Sessoes de suporte continuam abrindo RustDesk.
- Sessoes de jogo ainda nao sao aprovadas: a API devolve conflito `native-game/not-ready` para evitar que o usuario pense que RustDesk e o modo jogo.

## Proxima implementacao

O proximo componente e o cliente nativo Windows, com host no computador remoto e transporte de video/entrada. O painel ja tem o ponto de integracao para autorizar essa sessao sem misturar o fluxo de suporte.

## Validacao

Antes de habilitar `game` em producao, validar em uma maquina Windows real:

- captura acelerada pela GPU;
- 1080p/60 FPS;
- teclado, mouse relativo e controle;
- conexao direta e relay;
- latencia, perda de pacotes e compatibilidade com o jogo escolhido;
- comportamento de anti-cheat sem tentar contorna-lo.
