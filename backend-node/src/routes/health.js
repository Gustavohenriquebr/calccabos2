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

async function checkPythonHealth() {
  const config = getPythonServiceConfig()
  const baseHealthUrl = config.baseUrl ? `${config.baseUrl}/api/health` : null
  const baseReadyUrl = config.baseUrl ? `${config.baseUrl}/api/ready` : null

  if (config.missingInProduction) {
    return {
      status: 'down',
      baseUrl: null,
      required: true,
      explicit: false,
      pythonServiceUrlConfigured: false,
      pythonHealthUrl: null,
      pythonReadyUrl: null,
      error: {
        message: 'PYTHON_SERVICE_URL não configurado no Render.',
        statusCode: null,
        detail: 'PYTHON_SERVICE_URL não configurado no Render.',
      },
    }
  }

  if (config.loopbackInProduction) {
    return {
      status: 'down',
      baseUrl: config.baseUrl,
      required: config.required,
      explicit: config.explicit,
      pythonServiceUrlConfigured: false,
      pythonHealthUrl: baseHealthUrl,
      pythonReadyUrl: baseReadyUrl,
      error: {
        message: 'PYTHON_SERVICE_URL não configurado no Render.',
        statusCode: null,
        detail: `Valor atual aponta para loopback (${config.baseUrl}). Em producao Render, use a URL publica do backend Python.`,
      },
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
      baseUrl: config.baseUrl,
      required: config.required,
      explicit: config.explicit,
      pythonServiceUrlConfigured: true,
      pythonHealthUrl: healthUrl,
      pythonReadyUrl: readyUrl,
      endpoints: {
        health: { statusCode: healthRes.status, body: healthRes.data },
        ready: { statusCode: readyRes.status, body: readyRes.data },
      },
    }
  } catch (err) {
    return {
      status: 'down',
      baseUrl: config.baseUrl,
      required: config.required,
      explicit: config.explicit,
      pythonServiceUrlConfigured: true,
      pythonHealthUrl: healthUrl,
      pythonReadyUrl: readyUrl,
      error: {
        message: err.message,
        statusCode: err.response?.status || null,
        detail: err.response?.data?.detail || err.response?.data || null,
      },
    }
  }
}

router.get('/', async (_req, res) => {
  const mongoReadyState = mongoose.connection.readyState
  const mongoStatus = mongoReadyState === 1 ? 'ok' : 'down'
  const python = await checkPythonHealth()

  if (python.status === 'down') {
    python.hint = 'Verifique se o backend Python/FastAPI esta ativo e se PYTHON_SERVICE_URL aponta para a URL correta.'
  }

  const overall = mongoStatus === 'ok' && python.status === 'ok' ? 'ok' : 'degraded'

  res.json({
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
      host: mongoose.connection?.host || null,
    },
    python,
    pythonServiceUrlConfigured: Boolean(python.pythonServiceUrlConfigured),
    pythonHealthUrl: python.pythonHealthUrl || null,
  })
})

module.exports = router

