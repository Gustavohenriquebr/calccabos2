'use strict'

const router = require('express').Router()

const Projeto = require('../models/Projeto')
const Circuito = require('../models/Circuito')
const requireAuth = require('../middleware/auth')
const { agentRateLimit } = require('../middleware/apiRateLimit')
const { buildAgentFallback } = require('../services/agentFallback')
const { askTechnicalAssistant } = require('../services/aiAssistant')
const { errorText } = require('../utils/errorText')
const { assertUsageAllowed, consumeUsage } = require('../services/usage')
const {
  asString,
  assertObjectId,
  assertPlainObject,
  ensureNoUnknownFields,
  validationError,
} = require('../utils/validation')

const ALLOWED_BODY_FIELDS = ['projeto_id', 'mensagem', 'aba_atual', 'contexto_site', 'historico']
const ALLOWED_CONTEXT_FIELDS = ['rota', 'aba_atual', 'total_circuitos', 'circuitos_ok', 'circuitos_alerta', 'circuitos_criticos']

router.use(requireAuth)

function safeError(err) {
  if (err?.detail) return err.detail
  return {
    error: 'ai_error',
    detail: 'Nao foi possivel consultar o assistente tecnico agora.',
  }
}

function sanitizeHistory(historico) {
  if (historico === undefined) return []
  if (!Array.isArray(historico)) throw validationError('historico deve ser uma lista.')
  if (historico.length > 12) throw validationError('historico excede o limite de 12 mensagens.')
  return historico.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw validationError(`historico[${index}] invalido.`)
    }
    return {
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: asString(item.content, { label: `historico[${index}].content`, max: 1000, required: true }),
    }
  })
}

function sanitizeContext(contextoSite) {
  if (contextoSite === undefined || contextoSite === null) return {}
  assertPlainObject(contextoSite, 'contexto_site')
  ensureNoUnknownFields(contextoSite, ALLOWED_CONTEXT_FIELDS, 'contexto_site')
  return {
    rota: asString(contextoSite.rota, { label: 'contexto_site.rota', max: 160, required: false }),
    aba_atual: asString(contextoSite.aba_atual, { label: 'contexto_site.aba_atual', max: 80, required: false }),
    total_circuitos: contextoSite.total_circuitos,
    circuitos_ok: contextoSite.circuitos_ok,
    circuitos_alerta: contextoSite.circuitos_alerta,
    circuitos_criticos: contextoSite.circuitos_criticos,
  }
}

async function loadProjectContext({ projetoId, userId }) {
  if (!projetoId) return { projeto: null, circuitos: [] }

  const projetoObjectId = assertObjectId(projetoId, 'projeto_id')
  const projeto = await Projeto.findOne({ _id: projetoObjectId, usuarioId: userId }).lean()
  if (!projeto) {
    const err = new Error('Projeto nao encontrado.')
    err.status = 404
    err.detail = { error: 'not_found', detail: 'Projeto nao encontrado.' }
    throw err
  }

  const circuitos = await Circuito.find({ projetoId: projeto._id })
    .sort({ ordem: 1 })
    .limit(120)
    .lean()

  return { projeto, circuitos }
}

router.post('/chat', agentRateLimit, async (req, res, next) => {
  let mensagem = ''
  let projeto = null
  let circuitos = []

  try {
    assertPlainObject(req.body)
    ensureNoUnknownFields(req.body, ALLOWED_BODY_FIELDS)

    mensagem = asString(req.body.mensagem, { label: 'mensagem', max: 1800, required: true })
    const abaAtual = asString(req.body.aba_atual, { label: 'aba_atual', max: 80, required: false })
    const historico = sanitizeHistory(req.body.historico)
    const contextoSite = sanitizeContext(req.body.contexto_site)

    const loaded = await loadProjectContext({ projetoId: req.body.projeto_id, userId: req.user._id })
    projeto = loaded.projeto
    circuitos = loaded.circuitos
    await assertUsageAllowed(req.user, 'ai_assistant')

    const data = await askTechnicalAssistant({
      mensagem,
      historico,
      projeto,
      circuitos,
      abaAtual,
      contextoSite,
    })
    await consumeUsage(req.user, { aiMessages: 1 })

    return res.json({
      resposta: data.resposta,
      modelo: data.modelo,
      provider: data.provider,
      aviso: 'Assistente de apoio tecnico. Nao substitui validacao de engenheiro habilitado.',
    })
  } catch (err) {
    if (err.status === 400 || err.status === 401 || err.status === 404 || err.status === 429) {
      return next(err)
    }

    if (err.status === 503) {
      return res.status(503).json({
        ...safeError(err),
        resposta: buildAgentFallback({
          mensagem,
          projeto,
          circuitos,
          reason: errorText(err),
        }),
        modelo: 'offline-node-fallback',
        provider: 'node-fallback',
        fallback_offline: true,
      })
    }

    return next(err)
  }
})

module.exports = router
module.exports._internal = {
  ALLOWED_BODY_FIELDS,
  ALLOWED_CONTEXT_FIELDS,
  loadProjectContext,
  sanitizeContext,
  sanitizeHistory,
}
