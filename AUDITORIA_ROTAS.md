# AUDITORIA ROTAS & ARQUITETURA DE INFORMAÇÃO — CalcCabos

**Data:** 2026-08-24 · **Escopo:** auditoria somente-leitura (nenhuma alteração de produto)

---

## ETAPA 1 — MAPA COMPLETO DE ROTAS E ABAS

### 1.1 Rotas declaradas em `frontend/src/App.jsx`

| # | Rota | Componente | Guarda | Observações |
|---|------|-----------|--------|-------------|
| 1 | `/` | `Landing` | Pública (`PublicLanding`) | Se houver token em `localStorage`, redireciona para `/dashboard` |
| 2 | `/landing` | `Landing` | Pública (`PublicLanding`) | Alias de `/`; mesmo comportamento |
| 3 | `/login` | `Login` | Pública (`PublicAuth`) | Se autenticado, redireciona para `/dashboard` |
| 4 | `/cadastro` | `Login initialMode="registro"` | Pública (`PublicAuth`) | Mesmo componente Login em modo registro |
| 5 | `/dashboard` | `Dashboard` | Privada (`PrivateRoute` + `ErrorBoundary`) | Lista/cria projetos |
| 6 | `/projeto/:id` | `Projeto` | Privada (`PrivateRoute` + `ErrorBoundary`) | Workspace do projeto com 10 abas internas |

**Rotas catch-all:** não existe rota curinga (`*`). URL desconhecida renderiza página vazia (sem fallback 404). A verificar na Etapa 2.

### 1.2 Abas internas de `/projeto/:id` (fonte: `ABAS_PROJETO` em `ProjetoTabs.jsx`)

Aba ativa inicial ao abrir o projeto: **`circuitos`** (estado `useState('circuitos')` em `Projeto.jsx`).

| Ordem na tela | ID da aba | Label exibido | Componente responsável | API principal |
|---|---|---|---|---|
| 1 | `visao-geral` | Visão Geral | `VisaoGeralProjeto.jsx` (+ `projectHealth.js`, `CentralPendencias`, `CompletionScore`, `ReadinessBadge`) | — (usa props do projeto/circuitos já carregados) |
| 2 | `circuitos` | Circuitos | `CircuitTable` + `CircuitModal` + `CircuitosToolbar` + `ProtectionPanel` (inline em `Projeto.jsx`) | `/circuitos/projeto/:id`, POST/PUT/DELETE `/circuitos/`, POST `/circuitos/calcular-lote/:id` |
| 3 | `transformador` | Entrada / Trafo | `TransformadorEntrada.jsx` | PUT `/projetos/:id/transformador` |
| 4 | `sistema-trifasico` | Sistema Elétrico | `SistemaTrifasico.jsx` | GET/PUT `/projetos/:id/sistema-trifasico` |
| 5 | `protecoes` | Proteções | `ProtecoesProjeto.jsx` | GET/PUT `/projetos/:id/protecoes` |
| 6 | `diagrama-unifilar` | Unifilar | `DiagramaUnifilar.jsx` | — (renderiza de props; export SVG/PNG local) |
| 7 | `aterramento` | Aterramento | `AterramentoProjeto.jsx` | GET/PUT `/projetos/:id/aterramento` |
| 8 | `para-raios` | Para-raios | `ParaRaiosProjeto.jsx` | GET/PUT `/projetos/:id/para-raios` |
| 9 | `areas-classificadas` | Áreas Classificadas | `AreasClassificadasProjeto.jsx` | GET/PUT `/projetos/:id/areas-classificadas` |
| 10 | `memorial` | Memorial | `MemorialProjeto.jsx` | — (consolida de props; export via header: GET `/relatorios/:id/pdf` e `/relatorios/:id/excel`) |

**Agente IA:** NÃO é uma aba. Já é implementado como painel flutuante global (`FloatingAssistant.jsx`), acessível em qualquer aba via botão no header (`ProjectWorkspaceHeader`). Endpoint: POST `/agente/chat`.

**Importação de planilha:** modal `ExcelImportWizard` acionado pelo header (não é aba). Endpoint/serviço: `importador_circuitos.py`.

### 1.3 Dependências REAIS de dados entre abas (evidência no código)

#### `transformador` → é a RAIZ do fluxo
- Calcula e persiste: `corrente_nominal_primario/secundario`, `corrente_curto_secundario_ka` (Icc presumida), `relacao_transformacao`.
- **Nenhuma dependência de entrada.**

#### `circuitos` ← depende de `transformador`
- Frontend (`Projeto.jsx`, `circuitoVazioProjeto`): novo circuito herda `tensao` de `transformador.tensao_secundaria` e pré-preenche `isc_local` com `transformador.corrente_curto_secundario_ka`.
- Backend (`routers/circuitos.py:35-38`, `_aplicar_origem_transformador`): se `isc_local` vazio no create/update/cálculo, usa `transformador.corrente_curto_secundario_ka`.
- **Consequência:** sem Trafo preenchido, Icc dos circuitos fica vazia → verificação térmica de cabo e coordenação Icu ficam comprometidas.

#### `sistema-trifasico` ← consolida a partir de `circuitos` (quando existem)
- Backend (`services/projeto_eletrico.py:254`): `"origem": "circuitos"` — potências/corrente consolidadas dos circuitos.
- Sem circuitos: `"origem": "estimativa_manual"` (linha 216).
- Frontend também inicializa `tensao_linha` com `projeto.tensao_ref`.
- **Pode ser preenchido manualmente antes**, mas o valor "oficial" sobrescreve/vem dos circuitos.

#### `protecoes` ← depende de `transformador` + `circuitos`
- Backend (`services/protecao.py:310-311`): `corrente_barramento = transformador.corrente_nominal_secundario`; `icc_transformador = transformador.corrente_curto_secundario_ka`. Validações In≥Ibarramento e Icu≥Icc usam esses valores.
- Tabela "Proteções dos circuitos" lista validação por circuito — vazia sem circuitos calculados (EmptyState: "Cadastre circuitos e execute o cálculo").

#### `diagrama-unifilar` ← depende de `transformador` + `protecoes` + `circuitos`
- Renderiza automaticamente (useMemo) a partir de: `transformador_dados` (trafo/Icc), `protecao_geral_dados` (DJ geral), e cada circuito (potência, Ib, cabo sugerido, disjuntor sugerido, status).
- Sem dados: desenha estrutura com "N/D". Exportação SVG/PNG é manual.

#### `aterramento` — AUTOCONTIDO
- Medições Wenner com cálculo local ρ = 2πaR no próprio componente. Nenhuma leitura de outras abas.

#### `para-raios` — AUTOCONTIDO (no código)
- Validações próprias (FA×Vmax, margem vs NBI). Campo "Tipo de aterramento" é texto livre digitado — **não** puxa da aba Aterramento.

#### `areas-classificadas` — AUTOCONTIDA (no código)
- Cadastro de zonas/equipamentos Ex. Campo "Circuitos associados" é texto livre (ex.: "C-101, C-102") — **não** há vínculo automático com a aba Circuitos.

#### `visao-geral` e `memorial` ← consolidam TODAS as abas
- `VisaoGeralProjeto`/`projectHealth.js`: completude, prontidão e diagnóstico de módulos lendo todos os `_dados` do projeto + circuitos.
- `MemorialProjeto`: seções 0–14 consumindo `transformador_dados`, `sistema_trifasico_dados` (com recálculo local a partir dos circuitos), `protecao_geral_dados`, `para_raios_dados`, `aterramento_dados`, `areas_classificadas_dados`, circuitos.

### 1.4 Grafo de dependências (seta = "consome dados de")

```
transformador ──┬──> circuitos ──┬──> sistema-trifasico (consolidação automática)
                │                ├──> protecoes (validação por circuito)
                │                ├──> diagrama-unifilar (ramais)
                │                └──> memorial / visao-geral
                ├──> protecoes (corrente_barramento, icc_transformador)
                └──> diagrama-unifilar (trafo, Icc)
protecoes (DJ geral) ──> diagrama-unifilar
aterramento, para-raios, areas-classificadas ──> memorial / visao-geral (apenas consolidação)
```

---

## CHECKLIST DA ETAPA 2 — navegação e gravação

Para cada item abaixo: screenshot + vídeo + console (`page.on('console')`, `page.on('pageerror')`) + detecção de tela branca/spinner infinito/fallback de SPA.

- [ ] `/` (público, sem token)
- [ ] `/landing` (público, sem token)
- [ ] `/login` (público, sem token)
- [ ] `/cadastro` (público, sem token)
- [ ] `/rota-inexistente-teste` (comportamento sem catch-all)
- [ ] `/dashboard` (autenticado)
- [ ] `/projeto/:id` → aba `visao-geral`
- [ ] `/projeto/:id` → aba `circuitos`
- [ ] `/projeto/:id` → aba `transformador`
- [ ] `/projeto/:id` → aba `sistema-trifasico`
- [ ] `/projeto/:id` → aba `protecoes`
- [ ] `/projeto/:id` → aba `diagrama-unifilar`
- [ ] `/projeto/:id` → aba `aterramento`
- [ ] `/projeto/:id` → aba `para-raios`
- [ ] `/projeto/:id` → aba `areas-classificadas`
- [ ] `/projeto/:id` → aba `memorial`
- [ ] Painel flutuante Agente IA abre/fecha sobre as abas

---

## Resultado da Etapa 2 — Navegação

_(a preencher após execução do teste Playwright)_

---

## Teste Funcional End-to-End

**Data de execução:** _(a preencher na Etapa 4)_
**Ambiente:** Local (Mac) — Playwright Chromium

## Resumo

| Indicador | Valor |
|-----------|-------|
| Total de passos | 0 |
| Passou | 0 |
| Falhou | 0 |
| Parcial | 0 |
| Bloqueado | 0 |

---
