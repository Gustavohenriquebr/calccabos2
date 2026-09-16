# CalcCabos v1.0: GitHub e Render

O repositorio de deploy e `Gustavohenriquebr/calccabos` no GitHub.
O servico web executa o frontend React existente e a API Node na mesma origem.
O motor FastAPI permanece em um segundo servico; MongoDB Atlas persiste usuarios,
projetos e circuitos. Nao usar o antigo servidor emergencial com arrays em memoria.

## Comandos exatos

| Servico | Root Directory | Build Command | Start Command | Health Check |
| --- | --- | --- | --- | --- |
| Site + Node | vazio (raiz) | `npm run build:web` | `npm start` | `/health` |
| Python | `backend` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` | `/api/health` |

`node server.js` tambem inicia o servico web pela raiz. O build usa os lockfiles
dos dois pacotes e gera `frontend/dist` com API na mesma origem. Nao configura
localhost no JavaScript publicado. O modo local separado continua disponivel.

## Variaveis no Render

Node:

- `NODE_ENV=production` e `NODE_VERSION=22`.
- `MONGODB_URI`: URI real do Atlas, somente no painel, nunca no Git/chat.
- `MONGODB_DB_NAME=calccabos`, `MONGODB_TLS=true`.
- `JWT_SECRET` e `SESSION_SECRET`: valores aleatorios distintos, pelo menos 32 caracteres.
- `CORS_ORIGINS`: URL HTTPS exata do site, sem wildcard.
- `PYTHON_SERVICE_URL`: URL HTTPS do motor Python, sem localhost.
- `AI_ENABLED=false`.

Python:

- `ENVIRONMENT=production`, `PYTHON_VERSION=3.11.11`, `DOCS_ENABLED=false`.
- `SECRET_KEY`: valor aleatorio de pelo menos 32 caracteres.
- `CORS_ORIGINS`: URL HTTPS exata do site.
- `DATABASE_URL=sqlite:///./calc.db`: banco local auxiliar do motor; dados web ficam no Atlas.

O Blueprint gera os tres secrets novos. Ao reutilizar servicos existentes,
substituir manualmente qualquer segredo emergencial ou previamente exposto.
Isso invalida sessoes antigas. Nao reutilizar os exemplos enviados em conversas.

## Procedimento

1. Conectar o Render ao GitHub autorizado e selecionar este repositorio, branch `main`.
2. Usar o `render.yaml` da raiz ou configurar os dois servicos conforme a tabela.
3. Preencher Atlas, CORS e URL do motor no painel; manter planos Free.
4. Confirmar que os logs mostram clonagem do GitLab e os arquivos completos.
5. Aguardar os dois servicos ficarem ativos. Verificar `/health`: Mongo e Python devem estar `ok`.
6. Testar cadastro, login, criacao de projeto/circuito, calculo e PDF/Excel.
7. Reabrir a sessao e confirmar que os dados continuam no Atlas.

`render.yaml` deixa deploy automatico desligado para evitar publicar alteracoes
incompletas. Os servicos finais previstos sao `calccabos-final` e
`calccabos-python-final`. Nao apagar servicos ou dados antigos durante a
recuperacao sem confirmar que estes dois estao saudaveis.

## Regra de documento final

Relatorio final so deve sair quando todos os circuitos estiverem `OK` e os
dados obrigatorios do projeto estiverem presentes. Circuitos em `ALERTA`,
`BLOQUEADO`, `INCOMPLETO` ou `NAO_AVALIADO` devem gerar apenas documento
preliminar ate revisao tecnica.

## Validacao local

```sh
npm --prefix backend-node test
npm --prefix frontend run build
cd backend
venv/bin/python -m pytest tests/test_motor_cabos_auditavel.py tests/test_tensao_parametrizada.py
```

Build/testes locais nao comprovam disponibilidade publica. A publicacao so esta
concluida apos validar o fluxo real na URL do Render. CalcCabos e ferramenta de
apoio tecnico; validacao profissional continua necessaria.

Configuracao baseada na [referencia oficial de Blueprints](https://render.com/docs/blueprint-spec).
