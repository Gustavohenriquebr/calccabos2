# Validacao Tecnica do CalcCabos

Este documento organiza a base de validacao tecnica do CalcCabos. Os testes aumentam confianca e rastreabilidade, mas nao substituem norma vigente, julgamento de engenharia, ART/RRT quando aplicavel nem validacao por engenheiro eletricista habilitado.

## Escopo Atual

O CalcCabos possui validacoes para:

- corrente em sistemas monofasicos, trifasicos e CC;
- tensao parametrizada por valor livre, unidade, AC/DC, referencia, contexto e classificacao tecnica;
- potencia ativa, potencia aparente e potencia util de motor;
- transformadores trifasicos;
- queda de tensao;
- fatores de temperatura, agrupamento e metodo;
- selecao de secao por maior criterio aplicavel;
- protecao com dados ausentes como nao avaliada;
- bloqueios por disjuntor incompatível;
- aterramento, SPDA/para-raios, areas classificadas e MT/AT em testes didaticos especificos;
- relatorios profissionais com snapshot, preliminar/final e ausencia de linguagem de aprovacao automatica;
- seguranca basica de API, banco, autenticacao e IA auxiliar.

## Inventario de Testes Existentes

### Backend Python - motor tecnico

- `backend/tests/test_motor_cabos_auditavel.py`: unitarios de corrente, potencia, FP, queda, protecao, curto-circuito sem dados e decisao por maior criterio.
- `backend/tests/test_tensao_parametrizada.py`: classificacao BT/MT/AT/EAT/UAT, sistema CC, tensao ausente, DC sem FP/raiz de tres e bloqueio de aprovacao falsa em alta tensao.
- `backend/tests/test_casos_didaticos_aula2.py`: casos didaticos de sistemas trifasicos, motores e transformadores.
- `backend/tests/test_k2_agrupamento.py`: fator de agrupamento K2 por metodo.
- `backend/tests/test_queda_acumulada_etapa4.py`: queda de tensao acumulada.
- `backend/tests/test_etapa4_validacao.py`: validacoes tecnicas da etapa 4.
- `backend/tests/test_selecao_automatica.py`: selecao automatica de componentes.
- `backend/tests/test_protecoes_endpoint.py`: endpoint de protecoes.
- `backend/tests/test_protecao_mtat_aula4.py`: casos didaticos de disjuntores MT/AT.
- `backend/tests/test_aterramento_aula1p2.py`: aterramento.
- `backend/tests/test_para_raios_aula5.py`: para-raios.
- `backend/tests/test_pdf_module.py`: estrutura modular do PDF Python.
- `backend/tests/test_routes_catchall.py`: roteamento.

Pendencia detectada no Bloco 11: `test_protecoes_endpoint.py` e parte de `test_routes_catchall.py` ainda falham quando executados isoladamente porque a aplicacao usa uma sessao/banco sem a tabela `projetos` criada para o `TestClient`. Isso indica problema de fixture/configuracao de teste de API Python, nao alteracao validada do motor. Esses testes devem ser corrigidos antes de entrarem na bateria obrigatoria.

Pendencia adicional: `backend/test_api.py` e um smoke legado com `async def` sem marcador/configuracao pytest adequada. Ele deve ser refatorado para `pytest.mark.asyncio` ou convertido em teste sincrono antes de entrar na bateria obrigatoria.

### Backend Node - API, seguranca e documentacao

- `backend-node/tests/security.test.js`: headers, mass assignment, validacao numerica, regex segura e rate limit.
- `backend-node/tests/db-security.test.js`: MongoDB, modelos, indices e serializacao sem senha/hash.
- `backend-node/tests/ai-assistant.test.js`: IA segura, mock, chave ausente, contexto minimo e rate limit.
- `backend-node/tests/agent-route.test.js`: rota do agente protegida e validacoes.
- `backend-node/tests/professional-reports.test.js`: snapshot, PDF/Excel, abas, preliminar/final e hash.

### Frontend

- `frontend/tests/importer-utils.test.mjs`: importacao inteligente, filtros e validacao antes de importar.
- `frontend/tests/unifilar-model.test.mjs`: modelo do unifilar, status e vinculo com circuitos existentes.
- `frontend/tests/e2e/*.spec.ts`: suites Playwright existentes para fluxos de engenharia e stress visual/funcional.

## Casos de Ouro

Os casos de ouro ficam em:

- `validation/golden-cases/casos_ouro.json`

Cada caso possui:

- entrada;
- resultado esperado ou regra esperada;
- tolerancia;
- fonte resumida;
- observacao;
- status de validacao.

Casos iniciais:

- trifasico por potencia ativa: `P/(sqrt(3)*V*fp)`;
- motor com potencia util: `Pout/(eta*sqrt(3)*V*fp)`;
- transformador trifasico: `S/(sqrt(3)*V)`;
- tensao parametrizada: classificacao automatica sem limitar valores altos;
- protecao sem dados: `NOT_EVALUATED`, nunca `OK`;
- secao final: maior ou igual a todos os criterios aplicaveis.

## Casos das Aulas

Pasta local informada:

- `/Users/guga/Desktop/aulas`

Arquivos priorizados:

- `Aula2-P1-SistemasTrifasicoseTransformadorea615338.pdf`
- `Aula4-P1-ExerciciosdeDisjuntoresa615689.pdf`
- `Aula1-P1-IntroducaoaosProjetosEletricosIna613172.pdf`

Observacao: a extracao automatica de texto nao foi executada porque `pdftotext`, `pypdf`, `PyPDF2` e `pdfplumber` nao estavam disponiveis localmente. Os testes atuais usam casos resumidos ja codificados e referencias locais aos PDFs, sem copiar material integral.

## Testes Metamorficos

Arquivo:

- `backend/tests/test_metamorficos_validacao.py`

Invariantes cobertas:

- aumentar potencia nao pode reduzir corrente;
- reduzir fator de potencia nao pode reduzir corrente;
- aumentar distancia nao pode reduzir queda quando a secao permanece igual;
- agrupamento mais desfavoravel nao pode melhorar a secao;
- secao final deve ser maior ou igual a todos os criterios aplicaveis;
- falta de dado essencial nao pode virar `OK`;
- circuito `BLOCKED` deve bloquear emissao final de relatorio.
- tensao alta deve registrar limitacao e nao gerar aprovacao final automatica.

## Comparacao Externa Futura

Fontes publicas candidatas para comparacao, sem dependencia automatica dos testes:

- Prysmian CableApp: https://pt.prysmian.com/cableapp-calcular-seccao-de-cabos-eletricos
- Prysmian Cable App Brasil: https://conteudo.br.prysmian.com/cableapp
- Nexans EASYCALC: https://www.nexans.co.nz/en/Tools-Resources/easycalc.html
- WEG eCatalog / selecao de motores: https://ecatalog.weg.net/tec_cat/tech_motor_sel_web.asp
- WEG catalogo Brasil: https://www.weg.net/catalog/weg/BR/pt/Motores-El%C3%A9tricos/c/BR_MT
- Token Engenharia - calculadora de queda de tensao: https://tokenengenharia.com.br/calculadora-queda-de-tensao/

Uso recomendado:

- comparar manualmente entradas simples e registrar divergencias;
- salvar apenas dados do caso, resultado e referencia resumida;
- nao copiar catalogos completos;
- manter tolerancias explicitas;
- separar divergencia de arredondamento, criterio normativo e bug de software.

## Automacao

Comando recomendado:

```bash
./scripts/run_validation.sh
```

Esse script executa:

- testes tecnicos Python estaveis;
- smoke tests Python legados;
- testes Node de API, seguranca, relatorios e IA;
- testes frontend de importador e unifilar;
- build frontend.

Para investigar a pendencia de rotas Python com banco:

```bash
cd backend
venv/bin/python -m pytest tests/test_protecoes_endpoint.py tests/test_routes_catchall.py
```

## Limites e Riscos Tecnicos

- Tabelas internas de ampacidade e fatores devem ser confirmadas contra edicao normativa aplicavel e criterio do projeto.
- Resultados de protecao dependem de curva, Icu/Ics, fabricante e dados de curto-circuito.
- Curto-circuito termico depende de Icc e tempo de eliminacao confiaveis.
- Relatorios documentam o snapshot salvo, mas ainda nao anexam o unifilar persistido.
- Comparacao com fabricantes pode divergir por metodo, temperatura, norma, agrupamento, instalacao e arredondamento.
- Validacoes automatizadas nao equivalem a homologacao formal de produto de engenharia.
- AT/EAT/UAT e sistemas CC exigem estudos especificos de isolamento, coordenacao, equipamentos e protecao que ainda ficam parcial ou totalmente como nao avaliados.

## Proximos Passos de Homologacao

1. Extrair manualmente mais exercicios das aulas e transformar em casos de ouro pequenos.
2. Rodar casos equivalentes em Prysmian/Nexans/WEG quando aplicavel e registrar tolerancias.
3. Criar uma matriz por criterio: corrente, queda, ampacidade, protecao, curto, aterramento, SPDA e areas classificadas.
4. Revisar divergencias com professor ou engenheiro eletricista habilitado.
5. Persistir evidencias de homologacao por versao do motor (`engine_version`).

## Aviso Tecnico

O CalcCabos e uma ferramenta de apoio tecnico. A emissao de projeto, memorial, laudo, ART/RRT e decisao de conformidade devem ser feitas por profissional habilitado, com verificacao das normas e requisitos vigentes aplicaveis ao caso real.
