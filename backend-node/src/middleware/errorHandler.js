'use strict'

/**
 * Handler global de erros do Express.
 * Retorna JSON padronizado com error, detail e path.
 */
module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  const isValidation = err.name === 'ValidationError'
  const isDuplicate = err.code === 11000

  let detail = err.message || 'Erro interno do servidor'

  if (isValidation) {
    detail = Object.values(err.errors).map((e) => e.message).join('; ')
  }

  if (isDuplicate) {
    const field = Object.keys(err.keyValue || {})[0] || 'campo'
    detail = `${field} ja cadastrado`
  }

  const payload =
    err.detail && typeof err.detail === 'object'
      ? { ...err.detail }
      : {
          error: status >= 500 ? 'internal_server_error' : 'request_error',
          detail,
          path: req.path,
        }

  if (!payload.path) payload.path = req.path

  const logDetail = typeof detail === 'string' ? detail : JSON.stringify(detail)
  console.error(`[ERROR] ${req.method} ${req.path} -> ${status}: ${logDetail}`)

  res.status(status).json(payload)
}

