'use strict'

const router = require('express').Router()
const axios = require('axios')

const Projeto = require('../models/Projeto')
const Circuito = require('../models/Circuito')
const requireAuth = require('../middleware/auth')
const { buildPythonServiceUrl } = require('../config/pythonService')
const { buildPythonUpstreamError } = require('../utils/upstreamError')

router.use(requireAuth)
const PYTHON_REPORT_TIMEOUT_MS = parseInt(process.env.PYTHON_REPORT_TIMEOUT_MS || '180000', 10)
const PYTHON_REPORT_ATTEMPTS = Math.max(1, parseInt(process.env.PYTHON_REPORT_ATTEMPTS || '3', 10) || 3)

function isRetryablePythonError(err) {
  const status = err?.response?.status
  const code = String(err?.code || '').toUpperCase()
  if ([408, 429, 502, 503, 504].includes(status)) return true
  return ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postPythonReport(url, payload, tipo) {
  let lastError = null

  for (let attempt = 1; attempt <= PYTHON_REPORT_ATTEMPTS; attempt += 1) {
    try {
      console.log(`[PYTHON] Gerando relatorio ${tipo}: tentativa ${attempt}/${PYTHON_REPORT_ATTEMPTS}`)
      return await axios.post(url, payload, {
        responseType: 'arraybuffer',
        timeout: PYTHON_REPORT_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
    } catch (err) {
      lastError = err
      const retryable = isRetryablePythonError(err)
      console.warn(
        `[PYTHON] Falha ao gerar relatorio ${tipo} na tentativa ${attempt}/${PYTHON_REPORT_ATTEMPTS}: ${err.message}`
      )
      if (attempt >= PYTHON_REPORT_ATTEMPTS || !retryable) break
      await wait(1000 * attempt)
    }
  }

  throw lastError
}

router.get('/:projetoId/:tipo', async (req, res, next) => {
  let pythonUrl = ''
  try {
    const { projetoId, tipo } = req.params
    if (!['pdf', 'excel'].includes(tipo)) {
      return res.status(400).json({ detail: 'Tipo de relatorio invalido. Use pdf ou excel.' })
    }

    const projeto = await Projeto.findOne({ _id: projetoId, usuarioId: req.user._id }).lean()
    if (!projeto) return res.status(404).json({ detail: 'Projeto nao encontrado' })

    const circuitos = await Circuito.find({ projetoId }).sort({ ordem: 1 }).lean()
    pythonUrl = buildPythonServiceUrl(`/relatorio/${tipo}`)

    const { data, headers } = await postPythonReport(
      pythonUrl,
      {
        projeto,
        circuitos,
        usuario: {
          nome: req.user.nome,
          email: req.user.email,
          crea: req.user.crea,
          empresa: req.user.empresa,
        },
      },
      tipo
    )

    const contentType =
      headers['content-type'] ||
      (tipo === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const disposition =
      headers['content-disposition'] ||
      `attachment; filename="calccabos_${projetoId}.${tipo === 'pdf' ? 'pdf' : 'xlsx'}"`

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', disposition)
    res.send(Buffer.from(data))
  } catch (err) {
    if (err.response) {
      try {
        const body = JSON.parse(Buffer.from(err.response.data).toString())
        return res.status(err.response.status).json(body)
      } catch (_parseErr) {
        // segue para o handler padrao abaixo
      }
    }

    next(
      buildPythonUpstreamError(err, {
        operation: 'geracao de relatorio',
        pythonUrl: pythonUrl || `PYTHON_SERVICE_URL/relatorio/${req.params.tipo || 'pdf'}`,
      })
    )
  }
})

module.exports = router

