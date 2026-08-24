'use strict'

const router = require('express').Router()
const axios = require('axios')
const multer = require('multer')
const mongoose = require('mongoose')

const Circuito = require('../models/Circuito')
const Projeto = require('../models/Projeto')
const requireAuth = require('../middleware/auth')
const { buildPythonServiceUrl } = require('../config/pythonService')
const { buildPythonUpstreamError } = require('../utils/upstreamError')
const { errorText } = require('../utils/errorText')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const PYTHON_CALC_TIMEOUT_MS = parseInt(process.env.PYTHON_CALC_TIMEOUT_MS || '120000', 10)
const PYTHON_BATCH_CALC_TIMEOUT_MS = parseInt(process.env.PYTHON_BATCH_CALC_TIMEOUT_MS || '180000', 10)
const PYTHON_CALC_RETRIES = parseInt(process.env.PYTHON_CALC_RETRIES || '2', 10)
const PYTHON_READY_TIMEOUT_MS = parseInt(process.env.PYTHON_READY_TIMEOUT_MS || '15000', 10)
const PYTHON_IMPORT_CALC_BATCH_SIZE = Math.max(
  10,
  parseInt(process.env.PYTHON_IMPORT_CALC_BATCH_SIZE || '50', 10) || 50
)
const PYTHON_IMPORT_FALLBACK_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.PYTHON_IMPORT_FALLBACK_CONCURRENCY || '4', 10) || 4
)
const IMPORT_CONFIRM_LOCK_TIMEOUT_MS = parseInt(process.env.IMPORT_CONFIRM_LOCK_TIMEOUT_MS || '600000', 10)
const IMPORT_CONFIRM_LOCKS = new Map()

router.use(requireAuth)

function isRetryablePythonError(err) {
  const status = err?.response?.status
  const code = String(err?.code || '').toUpperCase()
  if ([502, 503, 504].includes(status)) return true
  return ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function splitIntoChunks(items, size) {
  const safeItems = Array.isArray(items) ? items : []
  if (!safeItems.length) return []
  const chunks = []
  for (let index = 0; index < safeItems.length; index += size) {
    chunks.push(safeItems.slice(index, index + size))
  }
  return chunks
}

function getImportLockKey(userId, projetoId) {
  return `${String(userId || 'anon')}:${String(projetoId || 'sem-projeto')}`
}

function acquireImportLock(lockKey) {
  const now = Date.now()
  const current = IMPORT_CONFIRM_LOCKS.get(lockKey)

  if (current && now - current.startedAt < IMPORT_CONFIRM_LOCK_TIMEOUT_MS) {
    return false
  }

  IMPORT_CONFIRM_LOCKS.set(lockKey, { startedAt: now })
  return true
}

function releaseImportLock(lockKey) {
  if (!lockKey) return
  IMPORT_CONFIRM_LOCKS.delete(lockKey)
}

function getErrorStatus(err) {
  return Number(err?.status || err?.statusCode || err?.response?.status || err?.detail?.upstream?.status || 0)
}

function logImport(event, payload = {}) {
  const line = {
    event,
    at: new Date().toISOString(),
    ...payload,
  }
  console.log(`[IMPORT] ${JSON.stringify(line)}`)
}

function normalizeImportError(err) {
  const status = getErrorStatus(err)

  if (status === 429) {
    const rateLimitError = new Error('Motor de cálculo recebeu muitas requisições. Aguarde alguns segundos e tente novamente.')
    rateLimitError.status = 429
    rateLimitError.detail = {
      error: 'python_rate_limited',
      detail: 'Motor de cálculo recebeu muitas requisições. Aguarde alguns segundos e tente novamente.',
      path: '/api/circuitos/importar-circuitos/confirmar',
    }
    return rateLimitError
  }

  if ([502, 503, 504].includes(status)) {
    const unavailableError = new Error('Motor de cálculo temporariamente indisponível.')
    unavailableError.status = 502
    unavailableError.detail = {
      error: 'python_temporarily_unavailable',
      detail: 'Motor de cálculo temporariamente indisponível.',
      path: '/api/circuitos/importar-circuitos/confirmar',
    }
    return unavailableError
  }

  return err
}

function isPythonUnavailableError(err) {
  const status = getErrorStatus(err)
  const code = String(err?.code || '').toUpperCase()
  return (
    err?.code === 'PYTHON_SERVICE_URL_MISSING' ||
    [502, 503, 504].includes(status) ||
    ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
  )
}

async function assertPythonReady(operation = 'verificacao de disponibilidade do motor Python') {
  let url = ''
  try {
    url = buildPythonServiceUrl('/api/ready')
    await axios.get(url, { timeout: PYTHON_READY_TIMEOUT_MS })
  } catch (err) {
    throw buildPythonUpstreamError(err, {
      operation,
      pythonUrl: url || 'PYTHON_SERVICE_URL/api/ready',
    })
  }
}

async function calcularNoFastAPI(dados, contexto) {
  const url = buildPythonServiceUrl('/calcular')
  let lastError = null

  for (let attempt = 0; attempt <= PYTHON_CALC_RETRIES; attempt += 1) {
    try {
      const response = await axios.post(
        url,
        { ...dados, contexto },
        {
          timeout: PYTHON_CALC_TIMEOUT_MS,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      )
      return response.data
    } catch (err) {
      lastError = err
      const isLastAttempt = attempt === PYTHON_CALC_RETRIES
      if (isLastAttempt || !isRetryablePythonError(err)) break
      await wait(1200 * (attempt + 1))
    }
  }

  throw buildPythonUpstreamError(lastError, {
    operation: 'calculo de circuito',
    pythonUrl: url,
  })
}

async function calcularLoteNoFastAPI(circuitos, contexto) {
  const url = buildPythonServiceUrl('/calcular-lote')
  let lastError = null

  for (let attempt = 0; attempt <= PYTHON_CALC_RETRIES; attempt += 1) {
    try {
      const response = await axios.post(
        url,
        { circuitos, contexto },
        {
          timeout: PYTHON_BATCH_CALC_TIMEOUT_MS,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      )
      return response.data
    } catch (err) {
      lastError = err
      const isLastAttempt = attempt === PYTHON_CALC_RETRIES
      if (isLastAttempt || !isRetryablePythonError(err)) break
      await wait(1200 * (attempt + 1))
    }
  }

  throw buildPythonUpstreamError(lastError, {
    operation: 'calculo em lote de circuitos',
    pythonUrl: url,
  })
}

function deveTentarCalculoIndividual(err) {
  const status = Number(err?.status || err?.response?.status || err?.detail?.upstream?.status || 0)
  return [404, 405, 413, 422, 500].includes(status)
}

async function calcularIndividualmente(circuitosComIndex, contexto) {
  const resultados = []
  const erros = []

  for (let index = 0; index < circuitosComIndex.length; index += PYTHON_IMPORT_FALLBACK_CONCURRENCY) {
    const chunk = circuitosComIndex.slice(index, index + PYTHON_IMPORT_FALLBACK_CONCURRENCY)
    const chunkResults = await Promise.all(chunk.map(async ({ circuito, index: resultIndex }) => {
      try {
        const resultado = await calcularNoFastAPI(circuito, contexto)
        return {
          index: resultIndex,
          id: circuito.id || circuito._id,
          resultado,
        }
      } catch (err) {
        const erro = {
          index: resultIndex,
          id: circuito.id || circuito._id,
          erro: errorText(err),
        }
        erros.push(erro)
        return erro
      }
    }))
    resultados.push(...chunkResults)
  }

  return { resultados, erros }
}

async function calcularLoteComFallback(circuitos, contexto) {
  try {
    const calculoLote = await calcularLoteNoFastAPI(circuitos, contexto)
    const resultados = Array.isArray(calculoLote?.resultados) ? calculoLote.resultados : []
    if (resultados.length > 0) {
      const resultadosPorIndex = new Map(resultados.map((item) => [Number(item.index), item]))
      const faltantes = circuitos
        .map((circuito, index) => ({ circuito, index }))
        .filter((item) => !resultadosPorIndex.get(item.index)?.resultado)

      if (faltantes.length > 0) {
        const fallback = await calcularIndividualmente(faltantes, contexto)
        fallback.resultados.forEach((item) => resultadosPorIndex.set(Number(item.index), item))
      }

      const finais = Array.from(resultadosPorIndex.values()).sort((a, b) => Number(a.index) - Number(b.index))
      return {
        ...calculoLote,
        resultados: finais,
        erros: finais.filter((item) => !item.resultado),
        calculados: finais.filter((item) => item.resultado).length,
      }
    }
  } catch (err) {
    if (!deveTentarCalculoIndividual(err)) {
      throw err
    }
  }

  const fallback = await calcularIndividualmente(
    circuitos.map((circuito, index) => ({ circuito, index })),
    contexto
  )

  return {
    total: circuitos.length,
    calculados: fallback.resultados.length - fallback.erros.length,
    erros: fallback.erros,
    resultados: fallback.resultados,
    fallback: 'calculo_individual',
  }
}

async function calcularImportacaoEmLotes(circuitos, contexto, meta = {}) {
  const lotes = splitIntoChunks(circuitos, PYTHON_IMPORT_CALC_BATCH_SIZE)
  const resultadosPorIndex = new Map()

  for (let loteIndex = 0; loteIndex < lotes.length; loteIndex += 1) {
    const lote = lotes[loteIndex]
    const offset = loteIndex * PYTHON_IMPORT_CALC_BATCH_SIZE
    const loteInfo = {
      userId: meta.userId,
      projetoId: meta.projetoId,
      requestId: meta.requestId,
      lote: loteIndex + 1,
      totalLotes: lotes.length,
      circuitos: lote.length,
    }

    logImport('python_lote_inicio', loteInfo)
    const calculoLote = await calcularLoteComFallback(lote, contexto)
    const resultados = Array.isArray(calculoLote?.resultados) ? calculoLote.resultados : []

    resultados.forEach((item, localIndex) => {
      const idx = Number.isFinite(Number(item?.index)) ? Number(item.index) : localIndex
      const globalIndex = offset + idx
      resultadosPorIndex.set(globalIndex, { ...item, index: globalIndex })
    })

    const calculados = resultados.filter((item) => item?.resultado).length
    const erros = resultados.length - calculados
    logImport('python_lote_fim', { ...loteInfo, calculados, erros })
  }

  return resultadosPorIndex
}

async function checkProjeto(projetoId, usuarioId) {
  if (!projetoId || !mongoose.Types.ObjectId.isValid(projetoId)) {
    const err = new Error('ID de projeto invalido')
    err.status = 400
    throw err
  }
  const projeto = await Projeto.findOne({
    _id: new mongoose.Types.ObjectId(projetoId),
    usuarioId: new mongoose.Types.ObjectId(usuarioId.toString()),
  }).lean()
  if (!projeto) {
    const err = new Error('Projeto nao encontrado')
    err.status = 404
    throw err
  }
  return projeto
}

function normalizarEntrada(body, projetoId) {
  const dados = { ...body }
  if (projetoId) dados.projetoId = projetoId
  const tiposValidos = ['CU-PVC', 'CU-XLPE', 'AL-PVC', 'AL-XLPE']
  if (!tiposValidos.includes(dados.tipo_cabo)) dados.tipo_cabo = 'CU-PVC'
  return dados
}

function resultadoFallbackCalculo(err) {
  return {
    status: 'alerta',
    status_final: 'ALERTA',
    validacao_status: 'ALERTA',
    validacao_mensagem: 'Circuito salvo sem calculo automatico porque o motor Python esta indisponivel.',
    nota_tecnica: `Calculo pendente: ${errorText(err)}`,
  }
}

router.get('/projeto/:projetoId', async (req, res, next) => {
  try {
    const projeto = await checkProjeto(req.params.projetoId, req.user._id)
    const { limit = 200, offset = 0, status, busca } = req.query
    const query = { projetoId: projeto._id }

    if (status) query.status_final = String(status).toUpperCase()
    if (busca) {
      const re = new RegExp(String(busca), 'i')
      query.$or = [{ descricao: re }, { tag: re }]
    }

    const circuitos = await Circuito.find(query)
      .sort({ ordem: 1 })
      .skip(parseInt(offset, 10))
      .limit(Math.min(parseInt(limit, 10), 1000))
      .lean()

    res.json(circuitos.map((c) => ({ ...c, id: c._id.toString() })))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const projetoId = req.body.projeto_id || req.body.projetoId
    const projeto = await checkProjeto(projetoId, req.user._id)
    const entrada = normalizarEntrada(req.body, projeto._id)

    if (!entrada.isc_local && projeto.transformador_dados?.corrente_curto_secundario_ka) {
      entrada.isc_local = projeto.transformador_dados.corrente_curto_secundario_ka
    }

    const circuito = await Circuito.create(entrada)
    let resultado
    try {
      resultado = await calcularNoFastAPI({ ...circuito.toObject(), id: circuito._id.toString() }, projeto.contexto)
    } catch (err) {
      await Circuito.findByIdAndDelete(circuito._id)
      throw err
    }

    const atualizado = await Circuito.findByIdAndUpdate(circuito._id, { $set: resultado }, { new: true, lean: true })
    if (atualizado) atualizado.id = atualizado._id.toString()
    res.status(201).json(atualizado)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'ID invalido' })
    }
    const circuito = await Circuito.findById(id).lean()
    if (!circuito) return res.status(404).json({ detail: 'Circuito nao encontrado' })
    await checkProjeto(circuito.projetoId, req.user._id)
    res.json({ ...circuito, id: circuito._id.toString() })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'ID invalido' })
    }

    const circuito = await Circuito.findById(id).lean()
    if (!circuito) return res.status(404).json({ detail: 'Circuito nao encontrado' })
    const projeto = await checkProjeto(circuito.projetoId, req.user._id)

    const entrada = normalizarEntrada(req.body, projeto._id)
    if (!entrada.isc_local && projeto.transformador_dados?.corrente_curto_secundario_ka) {
      entrada.isc_local = projeto.transformador_dados.corrente_curto_secundario_ka
    }

    await Circuito.findByIdAndUpdate(id, { $set: entrada })
    const atualizado = await Circuito.findById(id).lean()
    const resultado = await calcularNoFastAPI({ ...atualizado, id }, projeto.contexto)
    const final = await Circuito.findByIdAndUpdate(id, { $set: resultado }, { new: true, lean: true })
    if (final) final.id = final._id.toString()
    res.json(final)
  } catch (err) {
    next(err)
  }
})

router.delete('/projeto/:projetoId', async (req, res, next) => {
  try {
    const projeto = await checkProjeto(req.params.projetoId, req.user._id)
    const result = await Circuito.deleteMany({ projetoId: projeto._id })
    res.json({ ok: true, removidos: result.deletedCount || 0 })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ detail: 'ID invalido' })
    }
    const circuito = await Circuito.findById(id).lean()
    if (!circuito) return res.status(404).json({ detail: 'Circuito nao encontrado' })
    await checkProjeto(circuito.projetoId, req.user._id)
    await Circuito.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.post('/calcular-lote/:projetoId', async (req, res, next) => {
  try {
    const projeto = await checkProjeto(req.params.projetoId, req.user._id)
    const circuitos = await Circuito.find({ projetoId: projeto._id }).sort({ ordem: 1 }).lean()

    let calculados = 0
    const erros = []

    for (const circuito of circuitos) {
      try {
        const resultado = await calcularNoFastAPI({ ...circuito, id: circuito._id.toString() }, projeto.contexto)
        await Circuito.findByIdAndUpdate(circuito._id, { $set: resultado })
        calculados += 1
      } catch (err) {
        erros.push({ id: circuito._id, descricao: circuito.descricao, erro: err.message })
      }
    }

    res.json({ calculados, total: circuitos.length, erros })
  } catch (err) {
    next(err)
  }
})

router.post('/importar-circuitos/preview', upload.single('arquivo'), async (req, res, next) => {
  try {
    const projetoId = req.body.projeto_id || req.body.projetoId
    await checkProjeto(projetoId, req.user._id)
    // Mantem comportamento atual: fluxo local sem parser de planilha no Node.
    res.json({ linhas: [], colunas: [], mapeamento_sugerido: {} })
  } catch (err) {
    next(err)
  }
})

router.post('/importar-circuitos/confirmar', upload.single('file'), async (req, res, next) => {
  let importLockKey = null
  try {
    const contentType = (req.headers['content-type'] || '').toLowerCase()

    if (contentType.includes('application/json') || (req.body && req.body.linhas)) {
      const { projeto_id, linhas = [] } = req.body
      const requestId = String(req.headers['x-import-request-id'] || `imp-${Date.now()}`)
      const userId = String(req.user?._id || 'anon')
      importLockKey = getImportLockKey(userId, projeto_id)

      if (!acquireImportLock(importLockKey)) {
        return res.status(429).json({
          error: 'import_in_progress',
          detail: 'Ja existe uma importacao em andamento para este projeto. Aguarde a conclusao antes de tentar novamente.',
          path: '/api/circuitos/importar-circuitos/confirmar',
        })
      }

      logImport('confirmar_inicio', {
        requestId,
        userId,
        projetoId: projeto_id,
        linhasRecebidas: Array.isArray(linhas) ? linhas.length : 0,
        contentType,
      })

      const projeto = await checkProjeto(projeto_id, req.user._id)

      const maxOrdemDoc = await Circuito.findOne({ projetoId: projeto._id }).sort({ ordem: -1 }).lean()
      const maxOrdem = maxOrdemDoc?.ordem || 0
      const iscTrafo = projeto.transformador_dados?.corrente_curto_secundario_ka || null

      const preparados = []
      const erros = []
      const avisos = []

      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i]
        const dados = linha.circuito || linha
        if (!dados || typeof dados !== 'object') {
          erros.push({ linha: i + 1, erros: ['Dados invalidos'] })
          continue
        }

        try {
          const entrada = normalizarEntrada(dados, projeto._id)
          entrada.ordem = maxOrdem + preparados.length + 1
          if (!entrada.isc_local && iscTrafo) entrada.isc_local = iscTrafo

          const doc = new Circuito(entrada)
          await doc.validate()
          preparados.push({ linha: i + 1, doc })
        } catch (err) {
          erros.push({ linha: i + 1, erros: [err.message] })
        }
      }

      if (preparados.length === 0) {
        logImport('confirmar_sem_linhas_validas', {
          requestId,
          userId,
          projetoId: projeto_id,
          erros: erros.length,
        })
        return res.json({ criados: 0, erros, avisos, circuitos: [] })
      }

      await assertPythonReady('pre-validacao da importacao Excel')

      const insertedDocs = await Circuito.insertMany(
        preparados.map((item) => item.doc),
        { ordered: true }
      )

      const payloadCalculo = insertedDocs.map((doc) => {
        const raw = doc.toObject()
        return {
          ...raw,
          _id: doc._id.toString(),
          id: doc._id.toString(),
          projetoId: doc.projetoId?.toString?.() || String(doc.projetoId),
        }
      })

      let erroLote = null
      const resultadosPorIndex = new Map()
      try {
        const calculos = await calcularImportacaoEmLotes(payloadCalculo, projeto.contexto, {
          requestId,
          userId,
          projetoId: projeto_id,
        })
        calculos.forEach((value, key) => resultadosPorIndex.set(Number(key), value))
      } catch (err) {
        erroLote = err
        logImport('confirmar_python_erro', {
          requestId,
          userId,
          projetoId: projeto_id,
          status: getErrorStatus(err) || null,
          erro: errorText(err),
        })
        if (isPythonUnavailableError(err)) {
          await Circuito.deleteMany({ _id: { $in: insertedDocs.map((doc) => doc._id) } })
          throw normalizeImportError(err)
        }
      }

      const updates = []
      insertedDocs.forEach((doc, index) => {
        const resultadoLote = resultadosPorIndex.get(index)
        let resultado = resultadoLote?.resultado
        let erroCalculo = erroLote

        if (!resultado) {
          erroCalculo = erroCalculo || new Error(resultadoLote?.erro || 'Resposta do motor Python sem resultado para esta linha.')
          resultado = resultadoFallbackCalculo(erroCalculo)
          avisos.push({
            linha: preparados[index]?.linha ?? index + 1,
            aviso: 'Circuito importado, mas calculo automatico ficou pendente.',
            detalhe: errorText(erroCalculo),
          })
        }

        updates.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: resultado },
          },
        })
      })

      if (updates.length > 0) {
        await Circuito.bulkWrite(updates, { ordered: false })
      }

      const ids = insertedDocs.map((doc) => doc._id)
      const finais = await Circuito.find({ _id: { $in: ids } }).lean()
      const finaisPorId = new Map(finais.map((doc) => [doc._id.toString(), doc]))
      const criados = insertedDocs.map((doc) => {
        const final = finaisPorId.get(doc._id.toString()) || doc.toObject()
        return { ...final, id: doc._id.toString() }
      })

      logImport('confirmar_fim', {
        requestId,
        userId,
        projetoId: projeto_id,
        linhasRecebidas: Array.isArray(linhas) ? linhas.length : 0,
        linhasPreparadas: preparados.length,
        criados: criados.length,
        erros: erros.length,
        avisos: avisos.length,
      })

      return res.json({ criados: criados.length, erros, avisos, circuitos: criados })
    }

    const projetoId = req.body?.projeto_id || req.body?.projetoId
    await checkProjeto(projetoId, req.user._id)
    res.json({
      criados: 0,
      erros: [],
      circuitos: [],
      aviso: 'Importacao multipart indisponivel no backend atual; utilize o fluxo JSON ja validado.',
    })
  } catch (err) {
    next(normalizeImportError(err))
  } finally {
    releaseImportLock(importLockKey)
  }
})

module.exports = router

