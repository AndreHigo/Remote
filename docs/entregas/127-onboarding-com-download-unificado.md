# Entrega 127 - Download unificado do onboarding

O cadastro de um computador ganhou a acao `Baixar pacote de instalacao` no painel.

Quando o instalador esta publicado, a acao dispara:

- `remoto-agent-profile.json`, com API, relay e chave da instalacao;
- `RemotoAgent-Setup.exe`, o instalador Windows oficial.

Os dois arquivos sao baixados na pasta padrao do navegador, permitindo abrir o instalador diretamente nessa pasta. O instalador encontra o perfil, preenche os campos e remove o perfil depois de uma instalacao bem-sucedida.

Os botoes individuais continuam disponiveis para reparos, rebaixamento do perfil ou ambientes em que o instalador ainda nao foi publicado.

## Validacao

- `npm run typecheck -w apps/web`
- `npm run build -w apps/web`
- CI deve confirmar novamente `quality` e `windows-package` antes da entrega.

Este fluxo ainda depende de o navegador permitir os dois downloads e de o instalador publicado ser uma release valida. A instalacao elevada e a homologacao em outra maquina continuam sendo testes externos.
