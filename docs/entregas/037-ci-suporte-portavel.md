# Entrega 037 - Suporte portavel no CI

## Problema encontrado

O GitHub Actions executa os testes em Linux. O `SupportEngine` assumia que o comando `rustdesk` existia quando o sistema nao era Windows; isso fazia o `spawn` gerar `ENOENT` de forma assincrona e derrubava a suíte.

## Correção

- RustDesk agora e localizado por caminhos existentes ou pelo `PATH` real do sistema;
- a ausencia do cliente retorna `missing-engine` sem iniciar processo inexistente;
- falhas de `spawn` viram um resultado controlado e nao uma excecao global;
- a suíte desktop-control foi repetida com 16 testes passando.

## Evidência

```text
npm test: 4 + 7 + 16 + 4 testes passando
npm run typecheck: concluído sem erros
```
