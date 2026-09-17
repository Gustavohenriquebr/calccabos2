# CalcCabos v1.0 - Checklist de pre-lancamento

Este checklist organiza o estado atual para um lancamento publico controlado do CalcCabos v1.0. O produto deve ser tratado como ferramenta de apoio tecnico; a validacao final de projetos reais depende de profissional habilitado.

## Site oficial de teste

- Frontend/API Node: https://calccabos2.onrender.com
- Motor Python/FastAPI: https://calccabos2-python.onrender.com
- Repositorio GitHub: https://github.com/Gustavohenriquebr/calccabos2

## Servicos Render que devem permanecer

- `calccabos2`
  - Tipo: Web Service Node
  - Funcao: site publico, frontend React/Vite servido pelo Node e API principal.
  - Build: `npm run build:web`
  - Start: `npm start`

- `calccabos2-python`
  - Tipo: Web Service Python
  - Funcao: motor tecnico de calculo.
  - Build: `cd backend && pip install -r requirements.txt`
  - Start: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

## Servicos antigos que podem ser removidos manualmente no Render

Remover somente depois de confirmar que `calccabos2` e `calccabos2-python` continuam funcionando.

- `calccabos-final`
- `calccabos-python-final`
- `calccabos-v1-live`
- `calccabos-python-v1-live`
- `calccabos-public-v1`
- `calccabos-backend-python`

## Validacao executada

- Cadastro de usuario novo: aprovado.
- Sessao autenticada: aprovado.
- Criacao de projeto: aprovado.
- Cadastro de responsavel tecnico no projeto: aprovado.
- Criacao de circuito MT 13.8 kV: aprovado.
- Classificacao automatica de tensao MT: aprovado.
- Listagem de circuitos por projeto: aprovado.
- Importacao sem arquivo: rejeitada corretamente com HTTP 400.
- Relatorio final com alerta tecnico: bloqueado corretamente.
- Relatorio preliminar PDF: gerado corretamente.
- PDF preserva 13.8 kV e nao mostra 13800 kV: aprovado.
- PDF sem corrupcao de texto tecnico de queda de tensao: aprovado.
- Excel tecnico com aba Circuitos: aprovado.
- Excel preserva 13.8 kV: aprovado.

Artefatos locais:

- `qa-output/regression/online-regression-report.json`
- `qa-output/regression/online-mt-preliminar.pdf`
- `qa-output/regression/online-mt-preliminar.xlsx`
- `qa-output/regression/screenshots/`

## Pendencias antes de divulgar amplamente

- Trocar token do GitHub usado nos testes.
- Trocar usuario/senha temporarios do MongoDB Atlas.
- Atualizar as novas credenciais no Render.
- Remover servicos antigos do Render listados acima.
- Fazer teste manual em navegador real com uma conta nova.
- Revisar textos publicos da landing para evitar promessa de conformidade automatica.
- Decidir se o dominio publico final sera `onrender.com` ou dominio proprio.

## Criterios minimos para liberar teste publico

- Landing abre sem erro.
- Cadastro e login funcionam.
- Dashboard abre.
- Projeto pode ser criado.
- Circuito pode ser cadastrado e calculado.
- Memorial PDF preliminar e Excel sao gerados.
- Relatorio final fica bloqueado quando houver pendencias tecnicas.
- Nenhuma chave secreta aparece no codigo ou em arquivos versionados.
- Aviso de apoio tecnico e validacao profissional permanece visivel nos documentos.

## Proxima etapa recomendada

Executar uma rodada manual de aceite com usuario real:

1. Criar conta nova.
2. Criar projeto industrial em 380 V.
3. Criar projeto MT em 13.8 kV.
4. Cadastrar ao menos um circuito por projeto.
5. Conferir dashboard, Circuitos, Unifilar e Memorial.
6. Gerar PDF e Excel.
7. Registrar qualquer erro visual, texto confuso ou comportamento lento.
