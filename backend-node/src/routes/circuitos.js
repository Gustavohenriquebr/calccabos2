'use strict'

const router = require('express').Router()
const axios = require('axios')
const multer = require('multer')
const mongoose = require('mongoose')

const Circuito = require('../models/Circuito')
const Projeto = require('../models/Projeto')
const requireAuth = require('../middleware/auth')
const {
  batchCalcRateLimit,
  createCircuitRateLimit,
  importRateLimit,
} = require('../middleware/apiRateLimit')
const { buildPythonServiceUrl } = require('../config/pythonService')
const { buildPythonUpstreamError } = require('../utils/upstreamError')
const { errorText } = require('../utils/errorText')
const { assertUsageAllowed, consumeUsage } = require('../services/usage')
const {
  asBoolean,
  asEnum,
  asInteger,
  asNumber,
  asString,
  assertObjectId,
  assertPlainObject,
  ensureNoUnknownFields,
  rejectBlockedFields,
  sanitizeRegexText,
  validationError,
} = require('../utils/validation')

const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])
const ALLOWED_UPLOAD_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/octet-stream',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const originalName = String(file.originalname || '')
    const lower = originalName.toLowerCase()
    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : ''
    const mime = String(file.mimetype || '').toLowerCase()

    if (!originalName || originalName.includes('\0') || originalName.includes('/') || originalName.includes('\\')) {
      return cb(validationError('Nome de arquivo invalido.'))
    }

    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext) || !ALLOWED_UPLOAD_MIME.has(mime)) {
      return cb(validationError('Arquivo invalido. Envie apenas .xlsx, .xls ou .csv.'))
    }

    cb(null, true)
  },
})
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
  assertObjectId(projetoId, 'ID de projeto')
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

const CIRCUITO_INPUT_FIELDS = [
  'projeto_id',
  'projetoId',
  'ordem',
  'descricao',
  'tensao',
  'tensao_unidade',
  'tipo_sistema_tensao',
  'referencia_tensao_dc',
  'contexto_aplicacao',
  'potencia_kw',
  'potencia_kva',
  'fator_potencia',
  'distancia_m',
  'tipo_cabo',
  'temp_ambiente',
  'fases',
  'agrupamento',
  'corrente_ac_dc',
  'fator_demanda',
  'fator_eficiencia',
  'metodo_instalacao',
  'formacao',
  'comprimento_real',
  'queda_tensao_alimentador',
  'isc_local',
  'tempo_atuacao',
  'usar_kva_informado',
  'configuracao_eletrica',
  'referencia_tensao',
  'modo_entrada',
  'base_potencia',
  'corrente_informada',
  'aplicacao_circuito',
  'secao_minima_aplicacao',
  'secao_minima_mecanica',
  'queda_tensao_limite',
  'tag',
  'from_barramento',
  'to_equipamento',
  'protection_device',
  'modo_dimensionamento',
  'modo_selecao_componentes',
  'disjuntor_tensao_nominal',
  'disjuntor_corrente_nominal',
  'disjuntor_icu',
  'disjuntor_curva',
  'disjuntor_fabricante',
  'protecao_curva_fonte',
  'protecao_curva_pontos',
  'classe_tensao_kv',
  'nbi_kv',
  'tafi_ka',
  'sequencia_operacao',
  'meio_extincao',
  'tipo_acionamento',
  'acessorios',
  'modelo',
  'norma_referencia',
]

function normalizarEntrada(body, projetoId) {
  assertPlainObject(body)
  rejectBlockedFields(body)
  ensureNoUnknownFields(body, CIRCUITO_INPUT_FIELDS, 'circuito')

  const dados = {}
  if (projetoId) dados.projetoId = projetoId
  if (body.ordem !== undefined) dados.ordem = asInteger(body.ordem, { label: 'ordem', min: 0, max: 100000 })
  dados.descricao = asString(body.descricao, { label: 'descricao', max: 200, required: true })
  dados.tensao_unidade = asEnum(body.tensao_unidade, ['V', 'kV'], { label: 'tensao_unidade', fallback: 'V' })
  dados.tipo_sistema_tensao = asEnum(body.tipo_sistema_tensao || body.corrente_ac_dc, ['AC', 'DC'], { label: 'tipo_sistema_tensao', fallback: 'AC' })
  dados.tensao = asNumber(body.tensao, { label: 'tensao', min: 1, max: 2000000, required: true, nullable: false })
  dados.potencia_kw = asNumber(body.potencia_kw, { label: 'potencia_kw', min: 0, max: 1000000, required: true })
  if (body.potencia_kva !== undefined) dados.potencia_kva = asNumber(body.potencia_kva, { label: 'potencia_kva', min: 0, max: 1000000 })
  dados.fator_potencia = asNumber(body.fator_potencia ?? (dados.tipo_sistema_tensao === 'DC' ? 1 : 0.85), { label: 'fator_potencia', min: 0.01, max: 1, nullable: false })
  if (dados.tipo_sistema_tensao === 'DC') dados.fator_potencia = 1
  dados.distancia_m = asNumber(body.distancia_m, { label: 'distancia_m', min: 0, max: 100000, required: true })
  dados.tipo_cabo = asEnum(body.tipo_cabo, ['CU-PVC', 'CU-XLPE', 'AL-PVC', 'AL-XLPE'], {
    label: 'tipo_cabo',
    fallback: 'CU-PVC',
  })
  dados.temp_ambiente = asNumber(body.temp_ambiente ?? 30, { label: 'temp_ambiente', min: -50, max: 120, nullable: false })
  dados.fases = asInteger(body.fases ?? 3, { label: 'fases', min: 1, max: 3, nullable: false })
  dados.agrupamento = asInteger(body.agrupamento ?? 1, { label: 'agrupamento', min: 1, max: 200, nullable: false })
  dados.corrente_ac_dc = asEnum(body.corrente_ac_dc || dados.tipo_sistema_tensao, ['AC', 'DC'], { label: 'corrente_ac_dc', fallback: dados.tipo_sistema_tensao })
  dados.fator_demanda = asNumber(body.fator_demanda ?? 1, { label: 'fator_demanda', min: 0, max: 1, nullable: false })
  dados.fator_eficiencia = asNumber(body.fator_eficiencia ?? 1, { label: 'fator_eficiencia', min: 0.01, max: 1, nullable: false })
  dados.metodo_instalacao = asString(body.metodo_instalacao ?? 'TRAY', { label: 'metodo_instalacao', max: 80, nullable: false })
  dados.formacao = asInteger(body.formacao ?? 1, { label: 'formacao', min: 1, max: 20, nullable: false })

  const numericOptionals = [
    'comprimento_real',
    'queda_tensao_alimentador',
    'isc_local',
    'tempo_atuacao',
    'corrente_informada',
    'secao_minima_aplicacao',
    'secao_minima_mecanica',
    'queda_tensao_limite',
    'disjuntor_tensao_nominal',
    'disjuntor_corrente_nominal',
    'disjuntor_icu',
    'classe_tensao_kv',
    'nbi_kv',
    'tafi_ka',
  ]
  numericOptionals.forEach((field) => {
    if (body[field] !== undefined) dados[field] = asNumber(body[field], { label: field, min: 0, max: 1000000 })
  })

  const textOptionals = [
    'configuracao_eletrica',
    'referencia_tensao',
    'referencia_tensao_dc',
    'contexto_aplicacao',
    'modo_entrada',
    'base_potencia',
    'aplicacao_circuito',
    'tag',
    'from_barramento',
    'to_equipamento',
    'protection_device',
    'modo_dimensionamento',
    'modo_selecao_componentes',
    'disjuntor_curva',
    'disjuntor_fabricante',
    'protecao_curva_fonte',
    'sequencia_operacao',
    'meio_extincao',
    'tipo_acionamento',
    'modelo',
    'norma_referencia',
  ]
  textOptionals.forEach((field) => {
    if (body[field] !== undefined) dados[field] = asString(body[field], { label: field, max: 200 })
  })

  if (body.protecao_curva_pontos !== undefined) {
    if (!Array.isArray(body.protecao_curva_pontos) || body.protecao_curva_pontos.length > 32) {
      throw validationError('protecao_curva_pontos deve ser uma lista com no maximo 32 pontos.')
    }
    dados.protecao_curva_pontos = body.protecao_curva_pontos.map((point, index) => {
      if (!point || typeof point !== 'object' || Array.isArray(point)) {
        throw validationError(`protecao_curva_pontos[${index}] invalido.`)
      }
      const keys = Object.keys(point)
      if (keys.some((key) => !['multiplo_in', 'tempo_max_s'].includes(key))) {
        throw validationError(`protecao_curva_pontos[${index}] possui campo desconhecido.`)
      }
      const multiplo = asNumber(point.multiplo_in, { label: `protecao_curva_pontos[${index}].multiplo_in`, min: 0.01, max: 100000 })
      const tempo = asNumber(point.tempo_max_s, { label: `protecao_curva_pontos[${index}].tempo_max_s`, min: 0.000001, max: 100000 })
      return { multiplo_in: multiplo, tempo_max_s: tempo }
    }).sort((a, b) => a.multiplo_in - b.multiplo_in)
  }

  if (body.usar_kva_informado !== undefined) dados.usar_kva_informado = asBoolean(body.usar_kva_informado, { label: 'usar_kva_informado' })
  if (body.acessorios !== undefined) {
    if (typeof body.acessorios !== 'object' || Array.isArray(body.acessorios)) throw validationError('acessorios invalido.')
    rejectBlockedFields(body.acessorios, 'acessorios')
    if (Buffer.byteLength(JSON.stringify(body.acessorios), 'utf8') > 32 * 1024) throw validationError('acessorios excede o limite permitido.')
    dados.acessorios = body.acessorios
  }

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
    const limit = Math.min(asInteger(req.query.limit ?? 200, { label: 'limit', min: 1, max: 1000, nullable: false }), 1000)
    const offset = asInteger(req.query.offset ?? 0, { label: 'offset', min: 0, max: 1000000, nullable: false })
    const status = asString(req.query.status, { label: 'status', max: 40 })
    const busca = sanitizeRegexText(req.query.busca, { label: 'busca', max: 80 })
    const query = { projetoId: projeto._id }

    if (status) query.status_final = String(status).toUpperCase()
    if (busca) {
      const re = new RegExp(busca, 'i')
      query.$or = [{ descricao: re }, { tag: re }]
    }

    const circuitos = await Circuito.find(query)
      .sort({ ordem: 1 })
      .skip(offset)
      .limit(limit)
      .lean()

    res.json(circuitos.map((c) => ({ ...c, id: c._id.toString() })))
  } catch (err) {
    next(err)
  }
})

router.post('/', createCircuitRateLimit, async (req, res, next) => {
  try {
    const projetoId = req.body.projeto_id || req.body.projetoId
    const projeto = await checkProjeto(projetoId, req.user._id)
    await assertUsageAllowed(req.user, 'circuits.create', { projetoId: projeto._id, amount: 1 })
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
    assertObjectId(id, 'ID')
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
    assertObjectId(id, 'ID')

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
    assertObjectId(id, 'ID')
    const circuito = await Circuito.findById(id).lean()
    if (!circuito) return res.status(404).json({ detail: 'Circuito nao encontrado' })
    await checkProjeto(circuito.projetoId, req.user._id)
    await Circuito.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.post('/calcular-lote/:projetoId', batchCalcRateLimit, async (req, res, next) => {
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

router.post('/importar-circuitos/preview', importRateLimit, upload.single('arquivo'), async (req, res, next) => {
  try {
    const projetoId = req.body.projeto_id || req.body.projetoId
    await checkProjeto(projetoId, req.user._id)
    await assertUsageAllowed(req.user, 'spreadsheet_import')
    if (!req.file) throw validationError('Arquivo obrigatorio para pre-visualizacao da importacao.')
    // Mantem comportamento atual: fluxo local sem parser de planilha no Node.
    res.json({ linhas: [], colunas: [], mapeamento_sugerido: {} })
  } catch (err) {
    next(err)
  }
})

router.post('/importar-circuitos/confirmar', importRateLimit, upload.single('file'), async (req, res, next) => {
  let importLockKey = null
  try {
    const contentType = (req.headers['content-type'] || '').toLowerCase()

    if (contentType.includes('application/json') || (req.body && req.body.linhas)) {
      assertPlainObject(req.body)
      rejectBlockedFields(req.body)
      const { projeto_id, linhas = [] } = req.body
      if (!Array.isArray(linhas)) throw validationError('linhas deve ser uma lista.')
      if (linhas.length > 1000) throw validationError('Importacao limitada a 1000 linhas por requisicao.')
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
      await assertUsageAllowed(req.user, 'spreadsheet_import')
      await assertUsageAllowed(req.user, 'imported_rows', { amount: Math.max(1, linhas.length) })
      await assertUsageAllowed(req.user, 'circuits.create', { projetoId: projeto._id, amount: Math.max(1, linhas.length) })

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

      await consumeUsage(req.user, {
        spreadsheetImports: 1,
        importedRows: criados.length,
      })

      return res.json({ criados: criados.length, erros, avisos, circuitos: criados })
    }

    const projetoId = req.body?.projeto_id || req.body?.projetoId
    await checkProjeto(projetoId, req.user._id)
    await assertUsageAllowed(req.user, 'spreadsheet_import')
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
module.exports._internal = { normalizarEntrada, CIRCUITO_INPUT_FIELDS }
