# Contributing

O CalcCabos ainda esta em organizacao inicial. Este guia registra o fluxo minimo para colaboracao futura.

## Antes De Alterar

- Nao alterar motor de calculo sem tarefa especifica.
- Nao commitar secrets, `.env`, logs, bancos locais ou artefatos de build/teste.
- Manter mudancas pequenas e revisaveis.
- Rodar testes/builds relacionados.

## Fluxo Sugerido

1. Criar branch curta e descritiva.
2. Fazer alteracoes focadas.
3. Rodar validacoes.
4. Revisar `git status --short`.
5. Abrir PR com resumo, testes e riscos.

## Commits

Use mensagens claras, por exemplo:

```text
chore: prepare repository for github
feat: add spreadsheet import preview filters
fix: harden project ownership checks
```

## Validacoes

```bash
cd frontend && npm run build
cd frontend && npm run test:importer
cd backend-node && npm test
```

## Responsabilidade Tecnica

Alteracoes que impactam calculos, criterios normativos, memoriais ou relatorios devem ser revisadas por profissional habilitado.
