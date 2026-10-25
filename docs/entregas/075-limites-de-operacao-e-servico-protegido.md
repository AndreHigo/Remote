# 075 - Limites de operacao e servico Windows protegido

## Entregue

- Rotas autenticadas de criacao de comandos e sessoes agora possuem rate limit distribuido por usuario e dispositivo.
- O banco limita a 100 comandos pendentes ou em execucao por dispositivo e a 10 sessoes abertas por dispositivo.
- O agente agora rejeita qualquer tentativa de usar uma chave vinculada a outro computador nas rotas de dispositivo e na conclusao de comandos.
- O instalador standalone do servico aceita Node somente em `Program Files`, evitando que um servico `LocalSystem` execute binario vindo de pasta gravavel pelo usuario.
- A configuracao `.remoto-agent.config.json` recebe ACL restritiva tambem no instalador standalone.

## Validacao

- Typecheck completo.
- Testes unitarios e de seguranca.
- Smoke local com API, Postgres, Redis, agente e relay.

## Limites

Os tetos de pendencias protegem o dispositivo, mas nao substituem retencao/limpeza historica de comandos e sessoes. Essa politica deve ser revisada quando houver telemetria de uso real. A instalacao Windows ainda precisa de homologacao em uma maquina limpa, com UAC, antivirus e atualizacao sobre uma versao anterior.
