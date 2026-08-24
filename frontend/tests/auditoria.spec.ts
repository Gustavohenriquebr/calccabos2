import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ============================================================
// AUDITORIA DE NAVEGAÇÃO — Etapa 2
// Visita cada rota/aba, tira screenshot, coleta erros de console,
// pageerror e respostas HTTP >= 400. Grava resultados em JSON.
// Somente leitura do produto: cria um projeto temporário via API
// (proxy relativo /api do Vite) e o remove ao final.
//
// ESM-safe: package.json tem "type": "module" → __dirname não existe.
// Rodar APENAS este arquivo: npx playwright test tests/auditoria.spec.ts
// (filtro de arquivo evita carregar tests/e2e/*.spec.ts, que têm
// ReferenceError pré-existente de __dirname sob ESM).
// ============================================================

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SHOTS_DIR = path.join(AQUI, 'screenshots', 'auditoria')
const RESULTADOS_PATH = path.join(AQUI, 'auditoria-resultados.json')

type Registro = {
  alvo: string
  urlFinal: string
  carregouSemErro: boolean
  conteudoEsperadoOk: boolean
  telaBranca: boolean
  spinnerInfinito: boolean
  errosConsole: string[]
  errosPagina: string[]
  respostas4xx5xx: string[]
  mensagensErroVisiveis: string[]
  trechoTexto: string
}

type Coletores = {
  errosConsole: string[]
  errosPagina: string[]
  respostas: string[]
}

function anexarColetores(page: Page): Coletores & { desanexar: () => void } {
  const dados: Coletores = { errosConsole: [], errosPagina: [], respostas: [] }
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === 'error') dados.errosConsole.push(msg.text().slice(0, 300))
  }
  const onPageError = (err: Error) => dados.errosPagina.push(String(err?.message || err).slice(0, 300))
  const onResponse = (res: { status(): number; url(): string; request(): { method(): string } }) => {
    if (res.status() >= 400) {
      dados.respostas.push(`${res.status()} ${res.request().method()} ${res.url()}`.slice(0, 300))
    }
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('response', onResponse)
  return {
    ...dados,
    desanexar: () => {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      page.off('response', onResponse)
    },
  }
}

async function coletarEstado(
  page: Page,
  col: Coletores,
  alvo: string,
  conteudoEsperadoOk: boolean,
  falhaNavegacao = false
): Promise<Registro> {
  let texto = ''
  try {
    texto = await page.evaluate(() => document.body?.innerText?.trim() ?? '')
  } catch {
    texto = '<falha ao ler DOM>'
  }

  const mensagensErroVisiveis = await page
    .evaluate(() => {
      const saida: string[] = []
      document.querySelectorAll('body *').forEach((el) => {
        const t = (el.textContent || '').trim()
        if (!t || t.length > 200 || el.children.length > 0) return
        if (/^(erro|falha|algo deu errado)/i.test(t) && !saida.includes(t)) saida.push(t)
      })
      return saida.slice(0, 8)
    })
    .catch(() => [])

  const telaBranca = texto.length < 20
  const spinnerInfinito = !conteudoEsperadoOk && /carregando/i.test(texto)
  const semErros =
    !falhaNavegacao && !telaBranca && col.errosPagina.length === 0 && mensagensErroVisiveis.length === 0

  return {
    alvo,
    urlFinal: page.url(),
    carregouSemErro: semErros,
    conteudoEsperadoOk,
    telaBranca,
    spinnerInfinito,
    errosConsole: col.errosConsole.slice(0, 10),
    errosPagina: col.errosPagina.slice(0, 10),
    respostas4xx5xx: col.respostas.slice(0, 15),
    mensagensErroVisiveis,
    trechoTexto: texto.replace(/\s+/g, ' ').slice(0, 220),
  }
}

function salvarRegistros(novos: Registro[]) {
  let todos: Registro[] = []
  try {
    if (fs.existsSync(RESULTADOS_PATH)) todos = JSON.parse(fs.readFileSync(RESULTADOS_PATH, 'utf-8'))
  } catch {
    todos = []
  }
  todos.push(...novos)
  fs.writeFileSync(RESULTADOS_PATH, JSON.stringify(todos, null, 2))

  novos.forEach((r) => {
    const status = r.carregouSemErro && r.conteudoEsperadoOk ? 'OK' : r.telaBranca ? 'TELA-BRANCA' : 'PROBLEMA'
    console.log(
      `[AUDITORIA] ${status.padEnd(12)} ${r.alvo} | conteudo=${r.conteudoEsperadoOk ? 'sim' : 'NAO'} | consoleErr=${r.errosConsole.length} | pageErr=${r.errosPagina.length} | http4xx5xx=${r.respostas4xx5xx.length}`
    )
  })
}

async function screenshot(page: Page, nome: string) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS_DIR, `${nome}.png`), fullPage: true }).catch(() => {})
}

/** Navega a uma URL, aguarda conteúdo esperado, fotografa e registra. */
async function auditarRota(
  page: Page,
  nome: string,
  url: string,
  seletorEsperado: string | null,
  timeoutMs = 15000
): Promise<Registro> {
  const col = anexarColetores(page)
  let conteudoOk = seletorEsperado === null
  let falhaNavegacao = false
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(1200)
    if (seletorEsperado) {
      try {
        await page.locator(seletorEsperado).first().waitFor({ state: 'visible', timeout: timeoutMs })
        conteudoOk = true
      } catch {
        conteudoOk = false
      }
    }
    await screenshot(page, nome)
  } catch {
    falhaNavegacao = true
    await screenshot(page, `${nome}-FALHA-Navegacao`)
  }
  const registro = await coletarEstado(page, col, nome, conteudoOk, falhaNavegacao)
  col.desanexar()
  return registro
}

/** Clica numa aba do workspace, aguarda o conteúdo dela, fotografa e registra. */
async function auditarAba(page: Page, idAba: string, seletorConteudo: string): Promise<Registro> {
  const col = anexarColetores(page)
  let conteudoOk = false
  try {
    await page.locator(`[data-testid="aba-${idAba}"]`).click()
    await page.locator(seletorConteudo).first().waitFor({ state: 'visible', timeout: 15000 })
    conteudoOk = true
  } catch {
    conteudoOk = false
  }
  await page.waitForTimeout(600)
  await screenshot(page, `aba-${idAba}`)
  const registro = await coletarEstado(page, col, `aba:${idAba}`, conteudoOk)
  col.desanexar()
  return registro
}

// Ordem das abas exatamente como definida em ProjetoTabs.jsx (ABAS_PROJETO)
const ABAS: Array<[string, string]> = [
  ['visao-geral', 'text=Diagnóstico de Circuitos'],
  ['circuitos', 'text=Nenhum circuito cadastrado'],
  ['transformador', 'text=Dados nominais do transformador'],
  ['sistema-trifasico', 'text=Potências e tensão'],
  ['protecoes', 'text=Disjuntor geral'],
  ['diagrama-unifilar', 'text=BARRAMENTO PRINCIPAL'],
  ['aterramento', 'text=Medições Wenner'],
  ['para-raios', 'text=Identificação e sistema'],
  ['areas-classificadas', 'text=Classificação da área'],
  ['memorial', 'text=Critérios de Cálculo de Cabos'],
]

test.describe('Auditoria — rotas públicas (sem sessão)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('navega e grava todas as rotas públicas + rota inexistente', async ({ page }) => {
    test.setTimeout(240000)
    const registros: Registro[] = []

    try {
      registros.push(await auditarRota(page, 'publica-raiz', '/', 'text=Um ambiente completo'))
      registros.push(await auditarRota(page, 'publica-landing', '/landing', 'text=Um ambiente completo'))
      registros.push(await auditarRota(page, 'publica-login', '/login', 'input[name="email"]'))
      registros.push(await auditarRota(page, 'publica-cadastro', '/cadastro', 'text=Criar conta técnica'))
      // Sem catch-all no App.jsx: registrar o que renderiza de fato
      registros.push(await auditarRota(page, 'rota-inexistente-sem-sessao', '/rota-inexistente-auditoria', null))
    } finally {
      salvarRegistros(registros)
    }
  })
})

test.describe('Auditoria — rotas autenticadas e abas do projeto', () => {
  test('dashboard + todas as abas de /projeto/:id + agente flutuante', async ({ page }) => {
    test.setTimeout(420000)
    const registros: Registro[] = []
    let projetoId: string | null = null

    try {
      // ── Dashboard ────────────────────────────────────────────
      const colDash = anexarColetores(page)
      let dashOk = false
      try {
        await page.goto('/dashboard', { waitUntil: 'load', timeout: 30000 })
        await page.getByTestId('btn-novo-projeto-header').waitFor({ state: 'visible', timeout: 20000 })
        dashOk = true
      } catch {
        dashOk = false
      }
      await page.waitForTimeout(800)
      await screenshot(page, 'autenticado-dashboard')
      registros.push(await coletarEstado(page, colDash, 'autenticado:/dashboard', dashOk))
      colDash.desanexar()

      // ── Cria projeto temporário via API (proxy relativo /api) ─
      projetoId = await page.evaluate(async () => {
        const token = localStorage.getItem('token')
        const r = await fetch('/api/projetos/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            nome: `AUDITORIA NAV ${Date.now()}`,
            cliente: 'Auditoria Automatizada',
            contexto: 'industrial',
            tensao_ref: 380,
          }),
        })
        if (!r.ok) throw new Error(`POST /projetos falhou: ${r.status}`)
        const j = await r.json()
        return String(j.id ?? j._id)
      })
      expect(projetoId).toBeTruthy()

      // ── Abertura do projeto (rota /projeto/:id) ───────────────
      registros.push(
        await auditarRota(page, 'projeto-abertura', `/projeto/${projetoId}`, '[data-testid="aba-circuitos"]')
      )

      // ── Cada aba, na ordem real da interface ──────────────────
      for (const [idAba, seletor] of ABAS) {
        registros.push(await auditarAba(page, idAba, seletor))
      }

      // ── Agente IA flutuante sobre as abas ─────────────────────
      const colAgente = anexarColetores(page)
      let agenteAbriu = false
      try {
        await page.getByRole('button', { name: 'Agente IA' }).click()
        await page
          .getByText('Sou o agente de engenharia do CalcCabos')
          .first()
          .waitFor({ state: 'visible', timeout: 10000 })
        agenteAbriu = true
      } catch {
        agenteAbriu = false
      }
      await page.waitForTimeout(500)
      await screenshot(page, 'agente-flutuante-aberto')
      registros.push(await coletarEstado(page, colAgente, 'agente-flutuante', agenteAbriu))
      colAgente.desanexar()
      if (agenteAbriu) {
        await page.getByRole('button', { name: 'Agente IA' }).click()
      }
    } finally {
      // ── Cleanup: remove o projeto temporário (best effort) ────
      if (projetoId) {
        await page
          .evaluate(async (id) => {
            await fetch(`/api/projetos/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            }).catch(() => {})
          }, projetoId)
          .catch(() => {})
      }
      salvarRegistros(registros)
    }
  })
})
