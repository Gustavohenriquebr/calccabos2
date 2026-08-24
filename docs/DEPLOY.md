# Deploy de Staging do CalcCabos

Este guia prepara um ambiente de teste, sem declarar producao final.

Arquitetura:

- Frontend React/Vite: Vercel
- Backend Node/Express: Render
- Backend Python/FastAPI: Render
- Banco principal: MongoDB Atlas
- Origem: GitHub

O deploy real deve ser feito somente depois de autorizacao explicita. Nunca envie arquivos `.env` reais para o Git.

## Estrutura de Deploy

| Parte | Pasta | Plataforma | Build | Start/Output | Health |
|---|---|---|---|---|---|
| Frontend | `frontend` | Vercel | `npm ci && npm run build` | `frontend/dist` | pagina Vite |
| API Node | `backend-node` | Render Web Service | `npm ci` | `npm start` | `/health` |
| Motor Python | `backend` | Render Web Service | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` | `/api/health` |

## Arquivos de Configuracao

- `/vercel.json`: configuracao para importar o repositorio pela raiz no Vercel.
- `/frontend/vercel.json`: configuracao alternativa se o projeto Vercel usar `frontend` como Root Directory.
- `/render.yaml`: Blueprint canonico para os dois servicos Render de staging.
- `/backend/render.yaml`: legado para deploy isolado do Python; nao usar junto com o Blueprint da raiz no mesmo ambiente.

## Variaveis do Frontend - Vercel

Definir no painel do projeto Vercel:

```env
VITE_API_URL=https://calccabos-staging-node.onrender.com
```

Se o nome do servico Node no Render for diferente, use a URL real do Render.

## Variaveis do Backend Node - Render

Obrigatorias:

```env
NODE_ENV=production
PYTHON_SERVICE_URL=https://calccabos-staging-python.onrender.com
MONGODB_URI=mongodb+srv://<usuario>:<senha>@<cluster>/<database>?retryWrites=true&w=majority
MONGODB_DB_NAME=calccabos_staging
MONGODB_APP_NAME=CalcCabos Staging API
MONGODB_TLS=true
JWT_SECRET=<segredo-longo-com-32-caracteres-ou-mais>
SESSION_SECRET=<outro-segredo-longo-com-32-caracteres-ou-mais>
JWT_EXPIRES=7d
CORS_ORIGINS=https://SEU-FRONTEND.vercel.app
```

IA auxiliar, inicialmente desligada em staging:

```env
AI_ENABLED=false
AI_PROVIDER=openai
OPENAI_API_KEY=
AI_MODEL=gpt-5.6
AI_MAX_TOKENS=900
AI_RATE_LIMIT=30
AI_TIMEOUT_MS=45000
```

Timeouts e importacao:

```env
PYTHON_CALC_TIMEOUT_MS=120000
PYTHON_BATCH_CALC_TIMEOUT_MS=180000
PYTHON_AGENT_TIMEOUT_MS=180000
PYTHON_REPORT_TIMEOUT_MS=180000
PYTHON_IMPORT_CALC_BATCH_SIZE=50
IMPORT_CONFIRM_LOCK_TIMEOUT_MS=600000
```

## Variaveis do Backend Python - Render

Obrigatorias:

```env
ENVIRONMENT=production
DOCS_ENABLED=false
SECRET_KEY=<segredo-longo-com-32-caracteres-ou-mais>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=https://calccabos-staging-node.onrender.com,https://SEU-FRONTEND.vercel.app
```

Opcional para banco local do motor Python:

```env
DATABASE_URL=sqlite:///./calc.db
```

Para staging gratuito, o Node/MongoDB Atlas deve ser a camada principal de dados. O Python deve ser tratado como motor tecnico/stateless sempre que possivel. SQLite em Render gratuito nao deve ser considerado persistencia confiavel.

Chaves de provedores tecnicos/IA, somente se for testar esses recursos:

```env
GEMINI_API_KEY=
GOOGLE_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_MODELS=gemini-2.5-flash,gemini-2.0-flash
GROQ_MODELS=llama-3.1-8b-instant
OPENROUTER_MODELS=openrouter/free,nvidia/nemotron-3-super:free,openai/gpt-oss-120b:free
```

## MongoDB Atlas

Para staging:

1. Criar um cluster gratuito.
2. Criar um usuario exclusivo para staging.
3. Usar privilegio minimo necessario no banco `calccabos_staging`.
4. Liberar acesso de rede conforme a politica escolhida para Render.
5. Copiar a URI para `MONGODB_URI` no Render, nunca para o Git.

## CORS

Node:

- Em desenvolvimento aceita `localhost` e `127.0.0.1`.
- Em staging/producao exige `CORS_ORIGINS`.
- Nao usar wildcard com credenciais.

Python:

- Recebe `CORS_ORIGINS` por ambiente.
- Em staging, incluir a URL do Node e, se houver chamada direta de browser, a URL do frontend.

## Ordem Recomendada Para Staging

1. Garantir que o repositorio esteja no GitHub sem secrets.
2. Criar/confirmar MongoDB Atlas staging.
3. Criar Blueprint no Render usando `/render.yaml`.
4. Definir secrets `sync: false` no Render.
5. Subir primeiro `calccabos-staging-python`.
6. Validar `https://calccabos-staging-python.onrender.com/api/health`.
7. Definir `PYTHON_SERVICE_URL` no Node com a URL real do Python.
8. Subir `calccabos-staging-node`.
9. Validar `https://calccabos-staging-node.onrender.com/health`.
10. Criar projeto Vercel a partir do GitHub.
11. Definir `VITE_API_URL` no Vercel apontando para o Node.
12. Atualizar `CORS_ORIGINS` do Node com a URL final do Vercel.
13. Rodar fluxo manual: login, criar projeto, criar circuito, gerar relatorio preliminar.

## Comandos Locais Antes Do Deploy

```bash
cd backend
venv/bin/python -m pytest tests/test_tensao_parametrizada.py tests/test_motor_cabos_auditavel.py

cd ../backend-node
npm test

cd ../frontend
npm run build
node --test tests/unifilar-model.test.mjs
npm run test:importer
```

Ou a bateria consolidada:

```bash
./scripts/run_validation.sh
```

## Checks Pos-Deploy

Node:

```bash
curl https://calccabos-staging-node.onrender.com/health
```

Python:

```bash
curl https://calccabos-staging-python.onrender.com/api/health
curl https://calccabos-staging-python.onrender.com/api/ready
```

Frontend:

- abrir URL de preview/staging do Vercel;
- confirmar que `VITE_API_URL` aponta para o Node;
- testar login/registro;
- criar projeto;
- criar circuito;
- gerar relatorio;
- verificar CORS no console do navegador.

## Pendencias Antes De Producao Final

- Definir dominio final.
- Definir politica real de backups e retencao.
- Revisar termos de uso, politica de privacidade e aviso tecnico.
- Separar staging/producao por bancos e secrets distintos.
- Decidir se o Python ficara realmente stateless ou se precisara de banco persistente.
- Validar limites de plano gratuito do Render/Vercel no momento do deploy.
