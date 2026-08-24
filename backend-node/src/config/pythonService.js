'use strict'

const DEFAULT_PYTHON_SERVICE_URL = 'http://localhost:8001'

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || String(process.env.RENDER || '').toLowerCase() === 'true'
}

function _normalizeBaseUrl(raw) {
  const value = String(raw || DEFAULT_PYTHON_SERVICE_URL).trim()
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`
  const noTrailingSlash = withProtocol.replace(/\/+$/, '')
  // Permite configurar PYTHON_SERVICE_URL com ou sem /api no final sem quebrar rotas.
  return noTrailingSlash.replace(/\/api$/i, '')
}

function isLoopbackUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?(\/|$)/i.test(String(url || '').trim())
}

function getPythonServiceConfig() {
  const explicitUrl = process.env.PYTHON_SERVICE_URL || process.env.PYTHON_SERVICE_PUBLIC_URL
  const missingInProduction = !explicitUrl && isProductionRuntime()
  const baseUrl = explicitUrl ? _normalizeBaseUrl(explicitUrl) : _normalizeBaseUrl(DEFAULT_PYTHON_SERVICE_URL)
  const loopbackInProduction = Boolean(explicitUrl) && isProductionRuntime() && isLoopbackUrl(baseUrl)

  return {
    explicit: Boolean(explicitUrl),
    required: isProductionRuntime(),
    missingInProduction,
    loopbackInProduction,
    baseUrl,
  }
}

function getPythonServiceBaseUrl(options = {}) {
  const config = getPythonServiceConfig()
  if (config.missingInProduction && !options.allowDefault) {
    const err = new Error('PYTHON_SERVICE_URL não configurado no Render.')
    err.status = 503
    err.code = 'PYTHON_SERVICE_URL_MISSING'
    err.detail = {
      error: 'python_service_url_missing',
      detail: 'PYTHON_SERVICE_URL não configurado no Render.',
      hint: 'Exemplo: PYTHON_SERVICE_URL=https://calccabos-backend-python.onrender.com',
    }
    throw err
  }
  if (config.loopbackInProduction) {
    const err = new Error('PYTHON_SERVICE_URL não configurado no Render.')
    err.status = 503
    err.code = 'PYTHON_SERVICE_URL_INVALID'
    err.detail = {
      error: 'python_service_url_invalid',
      detail: 'PYTHON_SERVICE_URL não configurado no Render.',
      hint: `Valor atual aponta para loopback (${config.baseUrl}). Em producao Render, use a URL publica do backend Python (https://SEU-BACKEND-PYTHON.onrender.com).`,
    }
    throw err
  }
  return config.baseUrl
}

function buildPythonServiceUrl(path = '', options = {}) {
  const base = getPythonServiceBaseUrl(options)
  const suffix = String(path || '').trim()
  if (!suffix) return base
  return suffix.startsWith('/') ? `${base}${suffix}` : `${base}/${suffix}`
}

module.exports = {
  DEFAULT_PYTHON_SERVICE_URL,
  getPythonServiceConfig,
  getPythonServiceBaseUrl,
  buildPythonServiceUrl,
}
