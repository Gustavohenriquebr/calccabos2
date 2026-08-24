# CalcCabos v1.0

Esta release prepara a primeira versao publica do CalcCabos como ferramenta web de apoio tecnico para projetos eletricos.

CalcCabos v1.0 nao e produto final definitivo, nao substitui validacao profissional e nao declara conformidade normativa automatica.

## O Que Entra Na v1.0

- Landing/site e fluxo web inicial.
- Cadastro e login com JWT.
- Dashboard tecnico de projetos.
- Criacao e edicao de projetos.
- Cadastro, edicao e calculo de circuitos.
- Motor de calculo auditavel via FastAPI.
- Backend Node/Express como API publica e camada de seguranca.
- MongoDB Atlas como banco principal da aplicacao web.
- Importacao inteligente de planilhas com preview, filtros, mapeamento e validacao antes de importar.
- Relatorios PDF e Excel com snapshot tecnico, status preliminar/final e aviso profissional.
- Memorial tecnico estruturado.
- Diagrama unifilar/editor visual inicial.
- IA auxiliar segura quando configurada, desligada por padrao em staging/producao sem chave.
- Feature flags e controle inicial de uso sem pagamento real.
- Configuracao de deploy para:
  - Frontend React/Vite no Vercel.
  - Backend Node/Express no Render.
  - Backend Python/FastAPI no Render.
  - MongoDB Atlas em producao.

## Limitacoes Conhecidas

- Nao ha Stripe, Mercado Pago ou checkout real nesta versao.
- Planos Free/Estudante/Pro existem como base SaaS, mas upgrade ainda e simulado.
- A IA depende de variaveis de ambiente e deve permanecer desativada se nao houver chave segura configurada.
- O unifilar e um editor/visualizador inicial, nao um CAD completo.
- Exportacao avancada de unifilar e integracoes CAD/BIM ficam para roadmap.
- Biblioteca de fabricantes, precos e datasheets ainda nao esta integrada.
- Validacoes tecnicas aumentam confianca, mas nao substituem revisao por engenheiro habilitado.
- Render Free pode hibernar servicos, causando primeira resposta lenta.
- SQLite do backend Python nao deve ser tratado como persistencia de producao; o banco principal web e MongoDB Atlas via Node.
- Dominios finais, politica de backup e documentos juridicos ainda precisam fechamento antes de producao comercial plena.

## Arquitetura De Deploy

| Camada | Plataforma | Pasta | Comando |
|---|---|---|---|
| Frontend | Vercel | `frontend` | `npm ci && npm run build` |
| API publica | Render | `backend-node` | `npm ci` / `npm start` |
| Motor tecnico | Render | `backend` | `pip install -r requirements.txt` / `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Banco | MongoDB Atlas | externo | URI via `MONGODB_URI` |

Health checks:

- Node: `/health`
- FastAPI: `/api/health` e `/api/ready`

## Variaveis De Ambiente

### Vercel

```env
VITE_API_URL=https://SEU-BACKEND-NODE.onrender.com
```

### Render Node/Express

```env
NODE_ENV=production
PYTHON_SERVICE_URL=https://SEU-BACKEND-PYTHON.onrender.com
MONGODB_URI=mongodb+srv://<usuario>:<senha>@<cluster>/<database>?retryWrites=true&w=majority
MONGODB_DB_NAME=calccabos
MONGODB_APP_NAME=CalcCabos API
MONGODB_TLS=true
JWT_SECRET=<segredo-longo-com-32-caracteres-ou-mais>
SESSION_SECRET=<outro-segredo-longo-com-32-caracteres-ou-mais>
JWT_EXPIRES=7d
CORS_ORIGINS=https://SEU-FRONTEND.vercel.app
AI_ENABLED=false
AI_PROVIDER=openai
OPENAI_API_KEY=
AI_MODEL=gpt-5.6
AI_MAX_TOKENS=900
AI_RATE_LIMIT=30
AI_TIMEOUT_MS=45000
PYTHON_CALC_TIMEOUT_MS=120000
PYTHON_BATCH_CALC_TIMEOUT_MS=180000
PYTHON_AGENT_TIMEOUT_MS=180000
PYTHON_REPORT_TIMEOUT_MS=180000
PYTHON_IMPORT_CALC_BATCH_SIZE=50
IMPORT_CONFIRM_LOCK_TIMEOUT_MS=600000
```

### Render FastAPI

```env
ENVIRONMENT=production
DOCS_ENABLED=false
SECRET_KEY=<segredo-longo-com-32-caracteres-ou-mais>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=https://SEU-BACKEND-NODE.onrender.com,https://SEU-FRONTEND.vercel.app
DATABASE_URL=sqlite:///./calc.db
GEMINI_API_KEY=
GOOGLE_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_MODELS=gemini-2.5-flash,gemini-2.0-flash
GROQ_MODELS=llama-3.1-8b-instant
OPENROUTER_MODELS=openrouter/free,nvidia/nemotron-3-super:free,openai/gpt-oss-120b:free
```

### MongoDB Atlas

- Criar cluster de producao ou staging dedicado.
- Criar usuario de banco com privilegio minimo.
- Usar database separado para producao.
- Configurar acesso de rede para Render conforme politica escolhida.
- Nunca salvar URI real em arquivo versionado.

## Como Testar Localmente

Validacao consolidada:

```bash
./scripts/run_validation.sh
```

Validacoes essenciais:

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

## Criterio De Aceite Manual

- Landing abre.
- Cadastro/login funcionam.
- Dashboard abre.
- Projeto pode ser criado.
- Circuito pode ser cadastrado.
- Calculo retorna resultado.
- Memorial/relatorio nao quebra.
- Nenhuma chave secreta aparece no codigo.
- Ambiente local continua funcionando.

## Aviso Tecnico

O CalcCabos e uma ferramenta de apoio tecnico. A emissao de projeto, memorial, laudo, ART/RRT e decisao de conformidade devem ser feitas por profissional habilitado, com verificacao das normas e requisitos vigentes aplicaveis ao caso real.

## Proximos Passos Pos-Lancamento

1. Testar fluxo completo no ambiente publicado.
2. Separar definitivamente staging e producao.
3. Configurar dominio final.
4. Revisar termos de uso, politica de privacidade e LGPD.
5. Monitorar erros de login, CORS, MongoDB e chamadas ao motor Python.
6. Definir politica de backup.
7. Implementar checkout real somente depois de validar estabilidade.
8. Expandir homologacao tecnica com casos de ouro e revisao profissional.
