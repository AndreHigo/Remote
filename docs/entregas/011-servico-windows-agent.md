# Entrega 011 - Servico Windows do agente

## Entregue

- `apps/agent/scripts/service-runner.cjs` executa o loop com o diretorio e configuracao corretos;
- `apps/agent/scripts/install-windows-service.ps1` cria o servico `RemotoAgent`;
- instalacao exige PowerShell elevado, build pronto e `agentKey` preenchido;
- servico inicia automaticamente com o Windows;
- falhas acionam reinicio progressivo pelo Service Control Manager;
- desinstalacao exige comando explicito `npm run agent:service:uninstall`.

## Uso

```powershell
npm run build
npm run agent:config:init
# preencher apps/agent/.remoto-agent.config.json
npm run agent:service:install
```

Para remover:

```powershell
npm run agent:service:uninstall
```

## Limites atuais

O instalador usa Node.js e o agente TypeScript compilado. Ainda nao e o instalador comercial final: faltam assinatura digital, pacote MSI, atualizacao assinada, coleta de logs centralizada e o cliente RustDesk configurado no mesmo instalador.
