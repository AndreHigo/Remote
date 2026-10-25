# Entrega 041 - Hardening de segurança e operação

## O que foi fechado

- sessões remotas são encerradas quando um dispositivo muda de cliente;
- sessões de um usuário são revogadas quando sua função muda ou ele é desativado;
- login aplica limites por combinação IP/e-mail, por IP e por e-mail, com mapa local limitado;
- rate limit genérico também tem limite máximo de entradas;
- inventário, saída de comando e erros de agente têm limites semânticos menores que o body HTTP;
- `db:seed` exige confirmação explícita, recusa `NODE_ENV=production` e não imprime credenciais;
- o engine de suporte mantém o processo RustDesk e encerra-o quando a sessão termina;
- relay tem limites globais de conexões e salas, além dos limites por endereço, por frame e por taxa de frames/bytes do host;
- o instalador remove ACEs de usuários comuns antes de proteger o arquivo de configuração;
- o instalador não passa a chave do agente na linha de comando; usa arquivo temporário e remove-o depois da leitura;
- backups PostgreSQL exigem `BACKUP_ENCRYPTION_KEY` e são gravados cifrados com verificação de integridade;
- release separa build de publicação, usa `contents: read` no build e exige certificado Authenticode para tags, inclusive para os executáveis dentro do ZIP.

## O que continua externo

- configurar os segredos `WINDOWS_CODESIGN_PFX_B64` e `WINDOWS_CODESIGN_PFX_PASSWORD` no GitHub;
- validar a assinatura e a publicação de uma tag real;
- testar NAT/relay, duas máquinas Windows, UAC, bloqueio de tela e jogos reais;
- aplicar backup criptografado e política de retenção na VPS.

## Validação

Depois desta entrega, executar `npm run validate:release`. A validação local não substitui a homologação entre duas máquinas nem a implantação real.
