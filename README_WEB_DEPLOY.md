# CalcCabos - Deploy Web (Vercel + Render)

Este guia cobre apenas a arquitetura web.

## 1) Arquitetura oficial

Fluxo de requisicao:

`Frontend React/Vite -> backend-node (Express) -> backend (FastAPI engine)`

Persistencia principal:

- MongoDB via backend-node

Responsabilidades:

- `frontend`: UI, autenticacao via JWT no header `Authorization`
- `backend-node`: rotas `/api/*`, auth, projetos, circuitos, proxy para Python
- `backend` (FastAPI): calculo tecnico, relatorios, assistente

## 2) Execucao local

Pre-requisitos:

- Node.js 20+
- Python 3.11+
- MongoDB acessivel

### 2.1 Backend Python

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 2.2 Backend Node

```bash
cd backend-node
npm install
npm run dev
```

### 2.3 Frontend

```bash
cd frontend
npm install
npm run dev
```

## 3) Variaveis de ambiente

## Frontend (Vercel)

- `VITE_API_URL=https://SEU-BACKEND-NODE.onrender.com`

Arquivo de exemplo: [frontend/.env.example](</C:/Users/GUSTAVO/Desktop/CalcCabos/frontend/.env.example>)

## backend-node (Render)

- `NODE_ENV=production`
- `MONGODB_URI=<mongo atlas uri>`
- `JWT_SECRET=<segredo jwt>`
- `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://SEU-FRONTEND.vercel.app`
- `PYTHON_SERVICE_URL`:
  - Local: `http://localhost:8001`
  - Render producao: `https://URL-DO-BACKEND-PYTHON.onrender.com`
  - Opcional em private networking: URL interna do servico Python no mesmo region/workspace.
  - Em producao essa variavel e obrigatoria. O Node nao deve usar `localhost`/`127.0.0.1` quando Python e Node estao em servicos Render separados.

Arquivo de exemplo: [backend-node/.env.example](</C:/Users/GUSTAVO/Desktop/CalcCabos/backend-node/.env.example>)

## backend Python (Render)

- `CORS_ORIGINS`
- `DOCS_ENABLED=false`
- `GEMINI_API_KEY` (opcional)
- `GOOGLE_API_KEY` (opcional)
- `GROQ_API_KEY` (opcional)
- `OPENROUTER_API_KEY` (opcional)
- `GEMINI_MODELS`, `GROQ_MODELS`, `OPENROUTER_MODELS` (opcionais)

Arquivo de exemplo: [backend/.env.example](</C:/Users/GUSTAVO/Desktop/CalcCabos/backend/.env.example>)

## 4) Deploy no Vercel (frontend)

Projeto no Vercel:

- **Root Directory**: `frontend`
- Framework: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Configuracao de fallback SPA:

- [frontend/vercel.json](</C:/Users/GUSTAVO/Desktop/CalcCabos/frontend/vercel.json>)

## 5) Deploy no Render (backend web)

Blueprint canônico:

- [render.yaml](</C:/Users/GUSTAVO/Desktop/CalcCabos/render.yaml>)

Servicos:

1. `calccabos-backend-node`
   - Root Directory: `backend-node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check: `/health`
2. `calccabos-backend-python`
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Health Check: `/api/health`

Observacao:

- O frontend Vercel chama apenas o backend Node.
- O backend Node chama o backend Python via `PYTHON_SERVICE_URL`.
- O `render.yaml` da raiz e a estrategia canonica atual.
- O `backend/render.yaml` e legado/isolado e nao deve substituir o blueprint da raiz no deploy web completo.

## 6) Health checks

## backend-node

- `GET /health`
- `GET /api/health`

Retorna:

- status do Node
- status/conexao do MongoDB
- status dos endpoints `/api/health` e `/api/ready` do Python
- `pythonServiceUrlConfigured` (true/false)
- `pythonHealthUrl` testada
- erro real da conexao com Python (quando falhar)

## Mapeamento de modulos Node -> FastAPI

O backend Node normaliza aliases antes de chamar `/calcular-modulo` no FastAPI:

- `sistema-trifasico` -> `sistema_trifasico`
- `sistema-trifasico-projeto` -> `sistema_trifasico`
- `protecao-geral` -> `protecoes`
- `para-raios` -> `para_raios`
- `areas-classificadas` -> `areas_classificadas`

## backend Python

- `GET /api/health`
- `GET /api/ready`

## 7) Comandos de build

Frontend:

```bash
cd frontend
npm run build
```

backend-node:

```bash
cd backend-node
npm install
npm start
```

backend Python:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## 8) Checklist de diagnostico rapido

## Erro 404 no login/cadastro

- Confirme `VITE_API_URL` apontando para backend-node
- Teste `GET https://<backend-node>/api/health`
- Teste `POST https://<backend-node>/api/auth/login`

## Erro CORS

- Verifique `CORS_ORIGINS` no backend-node
- Inclua dominio do Vercel
- Confirme se frontend esta usando HTTPS em producao

## Erro 502

- Verifique `GET /health` no backend-node
- Se `python.status=down` com erro de configuracao, configurar `PYTHON_SERVICE_URL` no backend Node.
- Se o erro citar `PYTHON_SERVICE_URL nao configurado no Render`, corrija a variavel no servico Node.
- Se `python.status=down`, verificar se `calccabos-backend-python` esta ativo e se a URL esta correta.
- Se `python.baseUrl` for `localhost`/`127.0.0.1` em producao separada, o backend Node esta mal configurado e vai retornar 503/502.
- Se `mongo.status=down`, revisar `MONGODB_URI`

## Falha de conexao frontend -> backend

- Verifique `VITE_API_URL` (sem `/api` duplicado)
- Verifique se backend-node esta publicado e acessivel externamente

## Falha backend-node -> backend Python

- Teste manual no backend-node:
  - `GET https://URL-DO-BACKEND-PYTHON.onrender.com/api/health`
  - `GET https://URL-DO-BACKEND-PYTHON.onrender.com/api/ready`
- Confirmar variavel `PYTHON_SERVICE_URL=https://URL-DO-BACKEND-PYTHON.onrender.com`

## 9) Seguranca

- `.env` local foi mantido para nao interromper ambiente atual.
- `.env.example` foi sanitizado com placeholders.
- Proximo passo obrigatorio (apos estabilizar deploy): revogar e rotacionar chaves expostas historicamente.

