# Entrega 084 - Onboarding com perfil de instalacao

## Entregue

- O painel baixa `remoto-agent-profile.json` com API, relay e chave da instalacao.
- O instalador Windows procura esse perfil na mesma pasta do executavel e preenche os campos automaticamente.
- Configuracao existente e parametros administrativos continuam tendo precedencia sobre o perfil.
- O preenchimento manual permanece disponivel quando o perfil nao esta presente.
- O painel orienta baixar perfil e instalador para a mesma pasta; nao exige terminal.

## Seguranca e uso

- O perfil contem uma credencial de cadastro de uso controlado; ele deve ser tratado como segredo e removido depois da instalacao.
- A chave continua sendo validada pelo servidor e vinculada ao primeiro computador autorizado.
- O perfil nao e enviado para a API pelo navegador; ele e salvo localmente pelo operador.

## Limite

O navegador ainda baixa dois arquivos separados. Um instalador personalizado por computador ou um pacote unico exige uma etapa posterior de distribuicao no servidor.
