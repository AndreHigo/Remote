# Seguranca

## Principios

- Nunca esconder acesso remoto do usuario local.
- Nunca permitir acesso sem autorizacao, politica cadastrada ou vinculo claro com o dispositivo.
- Registrar todas as acoes sensiveis.
- Reduzir privilegio por padrao.
- Separar dados por organizacao.
- Tratar o agente remoto como software sensivel.

## Riscos principais

### Uso indevido por engenharia social

Ferramentas de acesso remoto podem ser usadas para golpes. O produto precisa ter barreiras contra abuso.

Mitigacoes:

- aviso visual permanente durante sessao;
- consentimento local para acesso assistido;
- motivo obrigatorio para acesso nao assistido;
- logs visiveis para administradores;
- limite de tentativas;
- bloqueio de contas suspeitas;
- trilha de auditoria imutavel.

### Comprometimento de conta tecnica

Se um tecnico perder a conta, um atacante pode tentar acessar dispositivos.

Mitigacoes:

- 2FA obrigatorio para tecnicos e administradores;
- sessoes curtas;
- verificacao de novo dispositivo;
- permissoes por grupo;
- bloqueio por IP ou geografia em planos avancados;
- alertas de comportamento anormal.

### Agente instalado indevidamente

Um agente pode ser instalado sem autorizacao do dono da maquina.

Mitigacoes:

- instalador vinculado a empresa/cliente;
- codigo de pareamento;
- chave do agente vinculada a um unico cliente;
- validacao de escopo do cliente em heartbeat, inventario, status e comandos;
- identificacao visual no agente;
- opcao local de ver detalhes da organizacao;
- politica clara para desinstalacao;
- assinatura digital do instalador.

### Vazamento de dados

Logs, gravacoes, inventario e arquivos podem conter dados sensiveis.

Mitigacoes:

- criptografia em transito;
- criptografia em repouso para objetos sensiveis;
- retencao configuravel;
- mascaramento de dados nos logs;
- segregacao por tenant;
- controle de acesso baseado em papel;
- backups com politica de restauracao testada.

### Relay e infraestrutura

Quando P2P falha, o trafego passa pelo relay. Isso aumenta custo e criticidade.

Mitigacoes:

- relay isolado da API principal;
- metricas de banda por organizacao;
- rate limits;
- protecao DDoS;
- chaves rotacionaveis;
- ambientes separados para teste, homologacao e producao.

## Permissoes iniciais

```text
Owner
  Gerencia organizacao, plano, usuarios, grupos, seguranca e auditoria.

Admin
  Gerencia clientes, dispositivos, tecnicos e politicas.

Tecnico Senior
  Acessa dispositivos permitidos, executa comandos e ve inventario.

Tecnico
  Acessa dispositivos permitidos com restricoes.

Cliente
  Abre chamado, autoriza acesso assistido e consulta historico permitido.
```

## Politicas de acesso

### Acesso assistido

Exige aceite local do usuario.

Campos de auditoria:

- tecnico;
- cliente;
- dispositivo;
- horario;
- IP do tecnico;
- motivo;
- aceite local;
- duracao.

### Acesso nao assistido

Permitido apenas quando:

- dispositivo esta cadastrado;
- politica da organizacao permite;
- tecnico tem permissao no grupo;
- 2FA esta ativo;
- motivo foi informado;
- acesso fica registrado.

### Modo vigilancia/visualizacao

Deve ser tratado como acesso sensivel, mesmo sem controle de mouse/teclado.

Regras:

- indicador visual;
- permissao separada;
- log separado;
- desabilitado por padrao para clientes sensiveis.

## Checklist LGPD

- Definir controlador e operador de dados.
- Criar politica de privacidade.
- Criar termo de uso para tecnicos e clientes.
- Permitir retencao configuravel de logs e gravacoes.
- Evitar coletar dados desnecessarios.
- Proteger dados de inventario.
- Registrar consentimento quando necessario.
- Ter processo de exclusao/exportacao de dados.

## Checklist tecnico de producao

- HTTPS em todos os servicos.
- Hash forte de senhas.
- 2FA.
- Segredos fora do repositorio.
- Rotacao de chaves.
- Logs estruturados.
- Alertas de falha de login.
- Rate limit em auth e pareamento.
- Backups testados.
- CI com lint, testes e verificacao de dependencias.
- Instalador assinado.
- Atualizacao automatica com assinatura/verificacao.

## Decisao sobre codigo aberto

Se RustDesk for modificado ou distribuido como parte do produto, a licenca AGPL-3.0 precisa ser respeitada. Antes de vender ou disponibilizar publicamente, validar com advogado ou especialista em licencas open source.

Estrategia mais segura no MVP:

- nao modificar RustDesk no inicio;
- usar servidor proprio e configuracao documentada;
- manter painel, API e automacoes como codigo proprio;
- registrar claramente quais componentes sao terceiros.
