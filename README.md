# CalcCabos

CalcCabos e uma ferramenta tecnica de apoio a projetos eletricos. O produto organiza dados de projeto, entrada de energia, circuitos, protecoes, unifilar, aterramento, para-raios, areas classificadas, memorial e relatorios em uma interface profissional para uso no Brasil.

> Aviso tecnico: o CalcCabos apoia analises, rastreabilidade e documentacao. Ele nao substitui revisao, responsabilidade tecnica, ART/RRT, validacao de profissional habilitado, requisitos de concessionaria ou conferencia conforme normas aplicaveis.

## Status Atual

Base em organizacao profissional para GitHub e deploy futuro. Ja foram trabalhados:

- seguranca base de autenticacao e sessao;
- endurecimento de APIs;
- preparacao para MongoDB Atlas;
- upload seguro e importacao inteligente de planilhas;
- IA auxiliar segura via backend;
- conceito visual interno tecnico inspirado no Figma;
- Dashboard e telas internas com tipografia revisada.

Deploy real, pagamentos, IA com chave do usuario e editor unifilar avancado permanecem em roadmap.

## Screenshots

Screenshots locais gerados para vitrine:

- `frontend/screenshots/dashboard-tecnico.png`
- `frontend/screenshots/visao-geral-interna.png`
- `frontend/screenshots/circuitos-interna.png`
- `frontend/screenshots/memorial-interna.png`

As imagens sao leves e podem ser usadas no README do GitHub. Artefatos de Playwright e builds nao devem ser versionados.

## Stack

- Frontend: React, Vite, Tailwind CSS, React Router, React Query.
- Backend Node: Express, Mongoose, JWT, bcryptjs, multer.
- Backend Python: FastAPI e motor tecnico de calculos.
- Desktop: Electron.
- Banco web previsto: MongoDB Atlas.
- Deploy previsto: Vercel para frontend e Render para APIs.
- Design: Figma.

## Arquitetura

```text
Frontend React/Vite
  -> Backend Node/Express
    -> MongoDB Atlas
    -> Backend Python/FastAPI
```

Responsabilidades principais:

- `frontend/`: interface web, shell interno tecnico, dashboard, projetos e importacao de planilhas.
- `backend-node/`: autenticacao, sessao, autorizacao por usuario, APIs publicas, MongoDB e proxy tecnico.
- `backend/`: motor tecnico em FastAPI, rotinas de calculo e apoio ao modo local/desktop.
- `electron/`: empacotamento desktop.
- `Normas Definitivas/`: referencias tecnicas estruturadas em JSON.
- `tools/`: utilitarios locais.

## Como Rodar Localmente

Instale dependencias:

```bash
npm install
cd frontend && npm install
cd ../backend-node && npm install
cd ../backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm run dev
```

Backend Node:

```bash
cd backend-node
npm run dev
```

Backend Python:

```bash
cd backend
uvicorn main:app --reload --port 8001
```

Demo visual interna:

```text
http://127.0.0.1:5173/#/projeto/demo-interno
```

## Variaveis De Ambiente

Use os arquivos `.env.example` como referencia:

- `.env.example`
- `frontend/.env.example`
- `backend-node/.env.example`
- `backend/.env.example`

Nunca versionar `.env` reais, tokens, senhas, certificados ou credenciais de provedor.

Em producao:

- `MONGODB_URI` deve vir de variavel de ambiente;
- `JWT_SECRET`, `SESSION_SECRET` e `SECRET_KEY` devem ser fortes e diferentes por ambiente;
- CORS deve permitir apenas dominios configurados;
- logs nao devem expor tokens, senhas ou payloads sensiveis.

IA auxiliar no backend Node:

- `AI_ENABLED`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `AI_MODEL`
- `AI_MAX_TOKENS`
- `AI_RATE_LIMIT`
- `AI_TIMEOUT_MS`

O frontend nunca deve chamar o provedor de IA diretamente. Para desenvolvimento local sem API real, use `AI_ENABLED=true` com `AI_PROVIDER=mock`.

## Testes

Frontend:

```bash
cd frontend
npm run build
npm run test:importer
```

Backend Node:

```bash
cd backend-node
npm test
```

## Seguranca

Medidas ja aplicadas:

- secrets obrigatorios em producao;
- fallback local temporario sem segredo fixo fraco;
- hash seguro de senha;
- rate limit em login/registro e endpoints sensiveis;
- validacao de inputs;
- bloqueio de mass assignment;
- autorizacao por dono de projeto;
- headers de seguranca;
- CORS por ambiente;
- upload de planilhas com extensao/tamanho/tipo controlados.
- IA chamada somente pelo backend, com contexto minimo do projeto e fallback controlado.

Veja tambem `SECURITY.md`.

## Roadmap

Veja `ROADMAP.md` para o plano completo. Proximos blocos previstos:

- GitHub como vitrine e primeiro commit organizado;
- deploy Vercel/Render;
- Cloudinary apenas para anexos/imagens quando necessario;
- BYOK futuro para IA, com chave temporaria por sessao ou criptografia forte no backend;
- editor visual/unifilar simplificado.

## Licenca

Este repositorio ainda nao possui licenca definida. Antes de publicar como open source, escolha explicitamente uma licenca.
