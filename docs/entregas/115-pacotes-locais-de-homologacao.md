# Entrega 115 - Pacotes locais de homologacao

Foram gerados localmente, a partir do estado atual do `main`:

- `apps/agent/release/RemotoAgent-Setup.exe`: instalador do agente com FFmpeg embutido;
- `apps/agent/release/RemotoAgent-Windows.zip`: pacote equivalente para homologacao;
- `apps/operator/release/Remoto-Operator-Setup-0.1.0.exe`: operador nativo com relatorio de qualidade.

O manifesto `RemotoAgent-package.json` confirma a origem e o SHA-256 do FFmpeg incluido. Os instaladores locais nao possuem assinatura Authenticode; os hashes sao evidencias do artefato desta maquina, nao uma assinatura de distribuicao.

Limites declarados pelo manifesto:

- fallback de captura/codificacao por CPU continua disponivel;
- audio de sistema depende de uma build FFmpeg com WASAPI e de homologacao real;
- gamepad virtual XInput/DirectInput continua fora do pacote;
- teste de duas maquinas, rede publica, UAC, tela bloqueada e compatibilidade por jogo continuam pendentes.
