# Entrega 106 - Preflight de release atualizado

Em 25/10/2026, o `npm run validate:release` foi executado novamente no estado atual do repositorio e concluiu sem falhas.

Foram validados:

- testes de seguranca da API, agente, captura/entrada, relay realtime e operador nativo;
- typecheck e build de todos os pacotes;
- auditoria de dependencias, sem vulnerabilidades reportadas;
- sintaxe do operador e tipagem do cliente smoke realtime;
- hardening do instalador, ACL da configuracao e diagnostico do host;
- existencia dos instaladores locais e hashes SHA-256;
- diff whitespace.

O preflight registrou o aviso esperado: a build local do FFmpeg nao oferece WASAPI loopback, portanto o modo jogo permanece video-only neste ambiente. O resultado nao substitui teste em duas maquinas Windows, assinatura Authenticode, configuracao da VPS ou medicao real de FPS, RTT, perda e reconexao.

O CI passou a validar tambem `RemotoAgent-package.json`, conferindo `schemaVersion`, versao e o estado declarado de FFmpeg antes de publicar os artefatos de homologacao.
