'use strict'

function toJsonSafe(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(toJsonSafe)
  if (typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) out[key] = toJsonSafe(val)
    return out
  }
  return String(value)
}

function buildPythonUpstreamError(err, { operation, pythonUrl }) {
  if ((err?.code === 'PYTHON_SERVICE_URL_MISSING' || err?.code === 'PYTHON_SERVICE_URL_INVALID') && err.detail) {
    return err
  }

  const status = err.status || err.statusCode || err.response?.status || 502
  const detailFromUpstream = err.response?.data?.detail || err.response?.data?.error
  const detail =
    detailFromUpstream ||
    err.message ||
    'Motor de calculo indisponivel no momento.'

  const error = new Error(`[Python] ${operation}: ${detail}`)
  error.status = status >= 400 && status <= 599 ? status : 502
  error.detail = {
    error: 'upstream_python_error',
    detail: `Falha ao executar ${operation} no motor Python.`,
    upstream: {
      service: 'python-fastapi',
      url: pythonUrl,
      status: err.response?.status || null,
      reason: toJsonSafe(detail),
    },
  }
  return error
}

module.exports = {
  buildPythonUpstreamError,
}

