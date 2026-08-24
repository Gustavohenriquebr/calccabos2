'use strict'

const router = require('express').Router()
const axios = require('axios')

const Projeto = require('../models/Projeto')
const Circuito = require('../models/Circuito')
const requireAuth = require('../middleware/auth')
const { buildPythonServiceUrl } = require('../config/pythonService')
const { buildPythonUpstreamError } = require('../utils/upstreamError')
const { buildAgentFallback } = require('../services/agentFallback')
const { errorText } = require('../utils/errorText')

router.use(requireAuth)
const PYTHON_AGENT_TIMEOUT_MS = parseInt(process.env.PYTHON_AGENT_TIMEOUT_MS || '180000', 10)
const PYTHON_AGENT_ATTEMPTS = Math.max(1, parseInt(process.env.PYTHON_AGENT_ATTEMPTS || '3', 10) || 3)

function isRetryablePythonError(err) {
  const status = err?.response?.status
  const code = String(err?.code || '').toUpperCase()
  if ([408, 429, 502, 503, 504].includes(status)) return true
  return ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postPythonAgent(url, payload) {
  let lastError = null

  for (let attempt = 1; attempt <= PYTHON_AGENT_ATTEMPTS; attempt += 1) {
    try {
      console.log(`[PYTHON] Chat tecnico: tentativa ${attempt}/${PYTHON_AGENT_ATTEMPTS}`)
      return await axios.post(url, payload, {
        timeout: PYTHON_AGENT_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
    } catch (err) {
      lastError = err
      const retryable = isRetryablePythonError(err)
      console.warn(`[PYTHON] Falha no chat tecnico tentativa ${attempt}/${PYTHON_AGENT_ATTEMPTS}: ${err.message}`)
      if (attempt >= PYTHON_AGENT_ATTEMPTS || !retryable) break
      await wait(1000 * attempt)
    }
  }

  throw lastError
}

router.post('/chat', async (req, res, next) => {
  let mensagem = ''
  let projetoCtx = null
  let circuitosCtx = []

  try {
    const { projeto_id, historico = [] } = req.body || {}
    mensagem = req.body?.mensagem || ''
    if (!mensagem) return res.status(400).json({ detail: 'mensagem e obrigatoria' })

    if (projeto_id) {
      const projeto = await Projeto.findOne({ _id: projeto_id, usuarioId: req.user._id }).lean()
      if (projeto) {
        projetoCtx = projeto
        circuitosCtx = await Circuito.find({ projetoId: projeto._id }).sort({ ordem: 1 }).lean()
      }
    }

    const url = buildPythonServiceUrl('/agente/chat')
    const { data } = await postPythonAgent(
      url,
      {
        mensagem,
        historico,
        projeto: projetoCtx,
        circuitos: circuitosCtx,
        usuario: {
          nome: req.user.nome,
          email: req.user.email,
        },
      }
    )

    res.json(data)
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data)

    try {
      return res.json({
        resposta: buildAgentFallback({
          mensagem,
          projeto: projetoCtx,
          circuitos: circuitosCtx,
          reason: errorText(err),
        }),
        modelo: 'offline-node-fallback',
        provider: 'node-fallback',
        fallback_offline: true,
      })
    } catch (_fallbackErr) {
      next(
        buildPythonUpstreamError(err, {
          operation: 'chat com assistente tecnico',
          pythonUrl: buildPythonServiceUrl('/agente/chat'),
        })
      )
    }
  }
})

module.exports = router

