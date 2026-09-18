'use strict'

const router = require('express').Router()
const axios = require('axios')
const mongoose = require('mongoose')
const { buildPythonServiceUrl, getPythonServiceConfig } = require('../config/pythonService')

function mongoStateLabel(readyState) {
  switch (readyState) {
    case 0:
      return 'disconnected'
    case 1:
      return 'connected'
    case 2:
      return 'connecting'
    case 3:
      return 'disconnecting'
    default:
      return 'unknown'
  }
}

function safePythonError(code = 'python_unavailable') {
  return {
    code,
    message: 'Serviço técnico Python indisponível no momento.',
  }
}

async function checkPythonHealth() {
  const config = getPythonServiceConfig()

  if (config.missingInProduction) {
    return {
      status: 'down',
      required: true,
      explicit: false,
      pythonServiceUrlConfigured: false,
      error: safePythonError('python_service_url_missing'),
    }
  }

  if (config.loopbackInProduction) {
    return {
      status: 'down',
      required: config.required,
      explicit: config.explicit,
      pythonServiceUrlConfigured: false,
      error: safePythonError('python_service_url_invalid'),
    }
  }

  const healthUrl = buildPythonServiceUrl('/api/health', { allowDefault: true })
  const readyUrl = buildPythonServiceUrl('/api/ready', { allowDefault: true })

  try {
    const [healthRes, readyRes] = await Promise.all([
      axios.get(healthUrl, { timeout: 3500 }),
      axios.get(readyUrl, { timeout: 3500 }),
    ])

    return {
      status: 'ok',
      required: config.required,
      explicit: config.explicit,
      pythonServiceUrlConfigured: true,
      endpoints: {
        health: { statusCode: healthRes.status },
        ready: { statusCode: readyRes.status },
      },
    }
  } catch {
    return {
      status: 'down',
      required: config.required,
      explicit: config.explicit,
      pythonServiceUrlConfigured: true,
      error: safePythonError('python_unavailable'),
    }
  }
}

// Liveness is intentionally dependency-free so Render can keep the process
// running while MongoDB or the Python engine recover from a cold start.
router.get('/live', (_req, res) => {
  res.json({ status: 'ok', service: 'calccabos-backend-node' })
})

async function healthPayload() {
  const mongoReadyState = mongoose.connection.readyState
  const mongoStatus = mongoReadyState === 1 ? 'ok' : 'down'
  const python = await checkPythonHealth()

  if (python.status === 'down') {
    python.hint = 'Verifique se o backend Python/FastAPI esta ativo e se PYTHON_SERVICE_URL aponta para a URL correta.'
  }

  const overall = mongoStatus === 'ok' && python.status === 'ok' ? 'ok' : 'degraded'

  return {
    status: overall,
    service: 'calccabos-backend-node',
    timestamp: new Date().toISOString(),
    node: {
      status: 'ok',
      version: process.version,
      uptimeSeconds: Math.round(process.uptime()),
    },
    mongo: {
      status: mongoStatus,
      readyState: mongoReadyState,
      readyStateLabel: mongoStateLabel(mongoReadyState),
      dbName: mongoose.connection?.name || null,
      configured: Boolean(process.env.MONGODB_URI),
    },
    python,
    pythonServiceUrlConfigured: Boolean(python.pythonServiceUrlConfigured),
  }
}

router.get('/', async (_req, res) => {
  res.json(await healthPayload())
})

router.get('/ready', async (_req, res) => {
  const payload = await healthPayload()
  if (payload.status !== 'ok') return res.status(503).json(payload)
  return res.json(payload)
})

module.exports = router
