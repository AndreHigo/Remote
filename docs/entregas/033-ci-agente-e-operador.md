# Entrega 033 - Cobertura de CI do agente e operador

## Entregue

- o workflow do GitHub Actions agora executa os testes do agente Windows;
- o workflow valida a sintaxe de `main.cjs`, `preload.cjs` e `renderer.js` do operador nativo;
- a cobertura de CI passa a acompanhar os componentes que participam do instalador e da sessao remota;
- a validacao continua ocorrendo antes do build e da verificacao dos Compose.

## Validacao local

```powershell
npm test
npm run typecheck
npm run build
node --check apps/operator/src/main.cjs
node --check apps/operator/src/preload.cjs
node --check apps/operator/src/renderer.js
```

O workflow ainda nao substitui o teste funcional em duas maquinas Windows nem o empacotamento assinado em um runner Windows.
