# Entrega 017 - preflight de producao

## Entregue

- Script que valida todas as variaveis obrigatorias da VPS.
- Bloqueio de placeholders, `localhost`, `127.0.0.1` e `example.com`.
- Tamanho minimo para senha do banco e segredos criptograficos.
- Validacao de sintaxe do Compose.
- Opcao de build das imagens antes do deploy.

## Uso

```powershell
npm run deploy:preflight
npm run deploy:preflight -- -Build
```

O arquivo esperado e `infra/docker/production.env`. Ele nunca deve ser commitado.
