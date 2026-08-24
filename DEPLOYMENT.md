# Deployment

Este documento prepara o deploy futuro. Nenhum deploy real foi feito neste bloco.

## Arquitetura Recomendada

- Frontend: Vercel ou Render Static Site.
- Backend Node/Express: Render Web Service.
- Backend Python/FastAPI: Render Web Service privado ou publico com CORS restrito.
- Banco: MongoDB Atlas.

## Variaveis De Ambiente

Frontend:

- `VITE_API_URL`

Backend Node:

- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `JWT_SECRET`
- `SESSION_SECRET`
- `CORS_ORIGINS`
- `PYTHON_API_URL`
- `AI_ENABLED`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `AI_MODEL`
- `AI_MAX_TOKENS`
- `AI_RATE_LIMIT`

Backend Python:

- `ENV`
- `SECRET_KEY`
- `DATABASE_URL`
- `ALLOWED_ORIGINS`

## Checklist Antes Do Deploy

- Confirmar que `.env` reais nao estao versionados.
- Rodar testes e build.
- Configurar CORS com dominios reais.
- Criar usuario MongoDB Atlas com privilegio minimo.
- Validar health checks.
- Revisar logs para nao expor dados sensiveis.
- Confirmar que `frontend/dist`, `playwright-report`, `test-results`, logs e bancos locais estao fora do Git.

## Comandos Locais De Validacao

```bash
cd frontend && npm run build && npm run test:importer
cd ../backend-node && npm test
```

## Observacao

Deploy publico deve acontecer somente apos revisao de secrets, configuracao dos provedores e autorizacao explicita.
