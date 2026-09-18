'use strict'

const router = require('express').Router()
const axios = require('axios')
const mongoose = require('mongoose')

const Projeto = require('../models/Projeto')
const Circuito = require('../models/Circuito')
const ProjetoRevision = require('../models/ProjetoRevision')
const requireAuth = require('../middleware/auth')
const { buildPythonServiceUrl } = require('../config/pythonService')
const { buildPythonUpstreamError } = require('../utils/upstreamError')
const { assertUsageAllowed } = require('../services/usage')
const {
  asEnum,
  asNumber,
  asString,
  assertObjectId,
  assertPlainObject,
  ensureNoUnknownFields,
  rejectBlockedFields,
  validationError,
} = require('../utils/validation')

const MODULO_ALIAS = {
  transformador: 'transformador',
  'sistema-trifasico': 'sistema_trifasico',
  sistema_trifasico: 'sistema_trifasico',
  'sistema-trifasico-projeto': 'sistema_trifasico',
  sistema_trifasico_projeto: 'sistema_trifasico',
  protecoes: 'protecoes',
  'protecao-geral': 'protecoes',
  protecao_geral: 'protecoes',
  'para-raios': 'para_raios',
  para_raios: 'para_raios',
  aterramento: 'aterramento',
  'areas-classificadas': 'areas_classificadas',
  areas_classificadas: 'areas_classificadas',
}
const PYTHON_MODULO_TIMEOUT_MS = parseInt(process.env.PYTHON_MODULO_TIMEOUT_MS || '20000', 10)
const PYTHON_MODULO_ATTEMPTS = Math.max(1, parseInt(process.env.PYTHON_MODULO_ATTEMPTS || '3', 10) || 3)

function mapModulo(modulo) {
  const key = String(modulo || '').trim()
  return MODULO_ALIAS[key] || key
}

function isRetryablePythonError(err) {
  const status = err?.response?.status
  const code = String(err?.code || '').toUpperCase()
  if ([408, 429, 502, 503, 504].includes(status)) return true
  return ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function calcularModulo(modulo, dados, extra = {}) {
  const mappedModulo = mapModulo(modulo)
  const url = buildPythonServiceUrl('/calcular-modulo')
  const payload = { modulo: mappedModulo, dados, ...extra }

  if (payload.transformador_dados && !payload.transformador) {
    payload.transformador = payload.transformador_dados
  }

  let lastError = null
  for (let attempt = 1; attempt <= PYTHON_MODULO_ATTEMPTS; attempt += 1) {
    try {
      console.log(`[PYTHON] Modulo ${mappedModulo}: tentativa ${attempt}/${PYTHON_MODULO_ATTEMPTS}`)
      const { data } = await axios.post(url, payload, { timeout: PYTHON_MODULO_TIMEOUT_MS })
      return data
    } catch (err) {
      lastError = err
      const retryable = isRetryablePythonError(err)
      console.warn(`[PYTHON] Falha no modulo ${mappedModulo} tentativa ${attempt}/${PYTHON_MODULO_ATTEMPTS}: ${err.message}`)
      if (attempt >= PYTHON_MODULO_ATTEMPTS || !retryable) break
      await wait(900 * attempt)
    }
  }

  throw buildPythonUpstreamError(lastError, {
    operation: `calculo do modulo ${modulo}`,
    pythonUrl: url,
  })
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

  projeto.id = projeto._id.toString()
  return projeto
}

const PROJETO_CREATE_FIELDS = [
  'nome', 'descricao', 'cliente', 'contexto', 'tensao_ref', 'uf', 'cidade', 'concessionaria', 'responsavelTecnico',
]
const PROJETO_UPDATE_FIELDS = [
  'nome',
  'descricao',
  'cliente',
  'contexto',
  'tensao_ref',
  'uf',
  'cidade',
  'concessionaria',
  'normaVersao',
  'responsavelTecnico',
  'revisao',
]
const CONTEXTOS = [
  'industrial', 'offshore', 'hospitalar', 'residencial', 'comercial', 'predial',
  'mineracao', 'subestacao', 'distribuicao', 'transmissao', 'geracao',
  'hidreletrica', 'termeletrica', 'nuclear', 'fotovoltaico', 'data_center', 'outro',
]

function sanitizeProjetoPayload(body, allowedFields, { create = false } = {}) {
  assertPlainObject(body)
  rejectBlockedFields(body)
  ensureNoUnknownFields(body, allowedFields)

  const out = {}
  if (body.nome !== undefined || create) out.nome = asString(body.nome, { label: 'nome', max: 200, required: create })
  if (body.descricao !== undefined) out.descricao = asString(body.descricao, { label: 'descricao', max: 2000 })
  if (body.cliente !== undefined) out.cliente = asString(body.cliente, { label: 'cliente', max: 200 })
  if (body.contexto !== undefined) out.contexto = asEnum(body.contexto, CONTEXTOS, { label: 'contexto' })
  if (body.tensao_ref !== undefined) out.tensao_ref = asNumber(body.tensao_ref, { label: 'tensao_ref', min: 1, max: 2000000 })
  if (body.uf !== undefined) out.uf = asString(body.uf, { label: 'uf', max: 2 }).toUpperCase()
  if (body.cidade !== undefined) out.cidade = asString(body.cidade, { label: 'cidade', max: 120 })
  if (body.concessionaria !== undefined) out.concessionaria = asString(body.concessionaria, { label: 'concessionaria', max: 160 })
  if (body.normaVersao !== undefined) out.normaVersao = asString(body.normaVersao, { label: 'normaVersao', max: 80 })
  if (body.responsavelTecnico !== undefined) {
    out.responsavelTecnico = asString(body.responsavelTecnico, { label: 'responsavelTecnico', max: 200 })
  }
  if (body.revisao !== undefined) out.revisao = asString(body.revisao, { label: 'revisao', max: 60 })

  return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined))
}

function sanitizeModuloPayload(body) {
  assertPlainObject(body)
  rejectBlockedFields(body)
  const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8')
  if (bytes > 128 * 1024) throw validationError('Payload do modulo excede o limite permitido.')
  return body
}

router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const projetos = await Projeto.find({ usuarioId: req.user._id }).sort({ criado_em: -1 }).lean()
    res.json(projetos.map((p) => ({ ...p, id: p._id.toString() })))
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const payload = sanitizeProjetoPayload(req.body, PROJETO_CREATE_FIELDS, { create: true })
    await assertUsageAllowed(req.user, 'projects.create')

    const projeto = await Projeto.create({
      usuarioId: req.user._id,
      ...payload,
      tensao_ref: payload.tensao_ref || 380,
    })

    res.status(201).json({ ...projeto.toObject(), id: projeto._id.toString() })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    res.json(projeto)
  } catch (err) {
    next(err)
  }
})

function revisionSnapshot(projeto) {
  return {
    nome: projeto.nome || null,
    descricao: projeto.descricao || null,
    cliente: projeto.cliente || null,
    contexto: projeto.contexto || null,
    tensao_ref: projeto.tensao_ref ?? null,
    normaVersao: projeto.normaVersao || null,
    responsavelTecnico: projeto.responsavelTecnico || null,
    revisao: projeto.revisao || '0',
  }
}

function changedRevisionFields(before, after) {
  return Object.keys(after).filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
}

router.get('/:id/revisoes', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    await assertUsageAllowed(req.user, 'revision_history')
    const limit = Math.min(asNumber(req.query.limit ?? 50, { label: 'limit', min: 1, max: 100, nullable: false }), 100)
    const revisoes = await ProjetoRevision.find({ projetoId: projeto._id, usuarioId: req.user._id })
      .sort({ criado_em: -1 })
      .limit(limit)
      .lean()
    res.json(revisoes.map((item) => ({ ...item, id: item._id.toString() })))
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const anterior = await checkProjeto(req.params.id, req.user._id)

    const update = sanitizeProjetoPayload(req.body, PROJETO_UPDATE_FIELDS)

    const projeto = await Projeto.findByIdAndUpdate(req.params.id, update, { new: true, lean: true })
    if (projeto) projeto.id = projeto._id.toString()
    if (projeto) {
      const antes = revisionSnapshot(anterior)
      const depois = revisionSnapshot(projeto)
      const camposAlterados = changedRevisionFields(antes, depois)
      if (camposAlterados.length > 0) {
        await ProjetoRevision.create({
          projetoId: projeto._id,
          usuarioId: req.user._id,
          revisao: depois.revisao,
          camposAlterados,
          antes,
          depois,
        })
      }
    }
    res.json(projeto)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    await checkProjeto(req.params.id, req.user._id)
    await Circuito.deleteMany({ projetoId: req.params.id })
    await Projeto.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.get('/:id/transformador', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('transformador', projeto.transformador_dados || {})
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

router.put('/:id/transformador', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('transformador', sanitizeModuloPayload(req.body))
    const update = { transformador_dados: resultado }
    if (resultado.tensao_secundaria) update.tensao_ref = Math.round(resultado.tensao_secundaria)
    await Projeto.findByIdAndUpdate(req.params.id, update)
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

router.get('/:id/sistema-trifasico', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const circuitos = await Circuito.find({ projetoId: projeto._id }).sort({ ordem: 1 }).lean()
    const resultado = await calcularModulo('sistema-trifasico', projeto.sistema_trifasico_dados || {}, {
      circuitos,
      tensao_ref: projeto.tensao_ref,
    })
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

router.put('/:id/sistema-trifasico', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const parcial = await calcularModulo('sistema-trifasico', sanitizeModuloPayload(req.body), { tensao_ref: projeto.tensao_ref })
    await Projeto.findByIdAndUpdate(req.params.id, { sistema_trifasico_dados: parcial })
    const circuitos = await Circuito.find({ projetoId: projeto._id }).sort({ ordem: 1 }).lean()
    const final = await calcularModulo('sistema-trifasico-projeto', parcial, {
      circuitos,
      tensao_ref: projeto.tensao_ref,
    })
    res.json(final)
  } catch (err) {
    next(err)
  }
})

router.get('/:id/protecoes', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const circuitos = await Circuito.find({ projetoId: projeto._id }).sort({ ordem: 1 }).lean()
    const resultado = await calcularModulo('protecoes', projeto.protecao_geral_dados || {}, {
      transformador_dados: projeto.transformador_dados || {},
      circuitos,
    })
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

async function salvarProtecoes(req, res, next) {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('protecao-geral', sanitizeModuloPayload(req.body), {
      transformador_dados: projeto.transformador_dados || {},
    })
    await Projeto.findByIdAndUpdate(req.params.id, { protecao_geral_dados: resultado })
    res.json(resultado)
  } catch (err) {
    next(err)
  }
}
router.post('/:id/protecoes', salvarProtecoes)
router.put('/:id/protecoes', salvarProtecoes)
router.post('/:id/protecoes/geral', salvarProtecoes)
router.put('/:id/protecoes/geral', salvarProtecoes)

router.get('/:id/para-raios', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('para-raios', projeto.para_raios_dados || {})
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

async function salvarParaRaios(req, res, next) {
  try {
    assertObjectId(req.params.id, 'ID')
    await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('para-raios', sanitizeModuloPayload(req.body))
    await Projeto.findByIdAndUpdate(req.params.id, { para_raios_dados: resultado })
    res.json(resultado)
  } catch (err) {
    next(err)
  }
}
router.post('/:id/para-raios', salvarParaRaios)
router.put('/:id/para-raios', salvarParaRaios)

router.get('/:id/aterramento', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('aterramento', projeto.aterramento_dados || {})
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

async function salvarAterramento(req, res, next) {
  try {
    assertObjectId(req.params.id, 'ID')
    await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('aterramento', sanitizeModuloPayload(req.body))
    await Projeto.findByIdAndUpdate(req.params.id, { aterramento_dados: resultado })
    res.json(resultado)
  } catch (err) {
    next(err)
  }
}
router.post('/:id/aterramento', salvarAterramento)
router.put('/:id/aterramento', salvarAterramento)

router.get('/:id/areas-classificadas', async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'ID')
    const projeto = await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('areas-classificadas', projeto.areas_classificadas_dados || {})
    res.json(resultado)
  } catch (err) {
    next(err)
  }
})

async function salvarAreasClassificadas(req, res, next) {
  try {
    assertObjectId(req.params.id, 'ID')
    await checkProjeto(req.params.id, req.user._id)
    const resultado = await calcularModulo('areas-classificadas', sanitizeModuloPayload(req.body))
    await Projeto.findByIdAndUpdate(req.params.id, { areas_classificadas_dados: resultado })
    res.json(resultado)
  } catch (err) {
    next(err)
  }
}
router.post('/:id/areas-classificadas', salvarAreasClassificadas)
router.put('/:id/areas-classificadas', salvarAreasClassificadas)

module.exports = router
