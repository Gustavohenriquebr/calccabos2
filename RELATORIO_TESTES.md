# RELATÓRIO DE TESTES — CalcCabos
Data: 2026-08-17
Ambiente: Local (Mac)

## RESUMO
- Total de endpoints testados: 26
- Passou (2xx): 26
- Falhou e foi corrigido: 1 (GET /api/circuitos/:id ausente em circuitos.js)
- Falhou e pendente: 0

## RESULTADO POR ENDPOINT

| Método | Rota | Status Antes | Status Depois | Observação |
|--------|------|-------------|---------------|------------|
| POST | /api/auth/registro | 201 | 201 | OK — Cria usuário e retorna JWT token |
| POST | /api/auth/login | 200 | 200 | OK — Suporta JSON `{email, senha}` e FormData `{username, password}` |
| GET | /api/auth/me | 200 | 200 | OK — Retorna perfil do usuário autenticado |
| GET | /api/health | 200 | 200 | OK — Health check completo (Node + Mongo + Python) |
| GET | /health | 200 | 200 | OK — Alias para health check |
| GET | /api/projetos | 200 | 200 | OK — Lista projetos do usuário |
| POST | /api/projetos | 201 | 201 | OK — Cria novo projeto |
| GET | /api/projetos/:id | 200 | 200 | OK — Detalhes do projeto |
| PUT | /api/projetos/:id | 200 | 200 | OK — Atualiza dados do projeto |
| DELETE | /api/projetos/:id | 200 | 200 | OK — Exclui projeto e circuitos associados |
| GET | /api/circuitos/projeto/:projetoId | 200 | 200 | OK — Lista circuitos por projeto |
| POST | /api/circuitos | 201 | 201 | OK — Cria e calcula circuito via Python FastAPI |
| GET | /api/circuitos/:id | 404 | 200 | Corrigido: handler GET /:id adicionado em circuitos.js |
| PUT | /api/circuitos/:id | 200 | 200 | OK — Atualiza e recalculado circuito |
| DELETE | /api/circuitos/:id | 200 | 200 | OK — Remove circuito individual |
| POST | /api/circuitos/calcular-lote/:projetoId | 200 | 200 | OK — Cálculo em lote |
| GET | /api/projetos/:id/transformador | 200 | 200 | OK — Módulo transformador |
| PUT | /api/projetos/:id/transformador | 200 | 200 | OK — Atualiza transformador |
| GET | /api/projetos/:id/sistema-trifasico | 200 | 200 | OK — Módulo sistema trifásico |
| GET | /api/projetos/:id/protecoes | 200 | 200 | OK — Módulo proteções |
| GET | /api/projetos/:id/para-raios | 200 | 200 | OK — Módulo para-raios |
| GET | /api/projetos/:id/aterramento | 200 | 200 | OK — Módulo aterramento |
| GET | /api/projetos/:id/areas-classificadas | 200 | 200 | OK — Módulo áreas classificadas |
| GET | /api/relatorios/:projetoId/pdf | 200 | 200 | OK — Geração de memorial técnico PDF |
| GET | /api/relatorios/:projetoId/excel | 200 | 200 | OK — Geração de planilha Excel |
| POST | /api/agente/chat | 200 | 200 | OK — Chat com assistente de engenharia |

## ERROS CORRIGIDOS
1. **GET /api/circuitos/:id (404 Not Found -> 200 OK)**:
   - **Arquivo**: `backend-node/src/routes/circuitos.js`
   - **Linha**: 398-410
   - **Descrição**: O handler para buscar um circuito específico por seu ID (`GET /:id`) não estava registrado no router Express de circuitos (havia apenas `GET /projeto/:projetoId`). Adicionamos a função `router.get('/:id', ...)` para validar o ObjectId Mongoose, checar a permissão de acesso ao projeto e retornar o objeto do circuito com `id` formatado.

2. **MongoDB Local Testing Fallback (Mongoose Exit -> Auto MongoMemoryServer)**:
   - **Arquivo**: `backend-node/src/config/database.js`
   - **Linha**: 10-25
   - **Descrição**: Em ambiente local quando `MONGODB_URI` não está configurada no `.env`, a API inicializa automaticamente o `mongodb-memory-server`, permitindo testes 100% autônomos e limpos.

3. **Frontend VITE_API_URL**:
   - **Arquivo**: `frontend/.env`
   - **Descrição**: Criado arquivo `frontend/.env` contendo `VITE_API_URL=http://localhost:8000` para apontar diretamente para o servidor Express Node.js.

## ERROS PENDENTES
Nenhum. Todos os 26 endpoints testados estão retornando status 200/201/204 com resposta JSON/Binary correta.

## ARQUIVOS MODIFICADOS
- `backend-node/src/routes/circuitos.js`
- `backend-node/src/config/database.js`
- `frontend/.env`
- `frontend/src/App.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/components/ErrorBoundary.jsx`
- `RELATORIO_TESTES.md`

## PRÓXIMOS PASSOS
1. Manter a suíte de testes com `curl` ou integrar com Jest/Supertest em `backend-node`.
2. Habilitar integração contínua (CI) para validar o build dos três serviços (Python, Node, React) em cada commit.
