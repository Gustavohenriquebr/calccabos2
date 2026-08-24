'use strict'

/**
 * Handler global de erros do Express.
 * Retorna JSON padronizado com error, detail e path.
 */
module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  const isValidation = err.name === 'ValidationError'
  const isDuplicate = err.code === 11000
  const isMulter = err.name === 'MulterError'

  let detail = err.message || 'Erro interno do servidor'

  if (isValidation) {
    detail = Object.values(err.errors).map((e) => e.message).join('; ')
  }

  if (isDuplicate) {
    const field = Object.keys(err.keyValue || {})[0] || 'campo'
    detail = `${field} ja cadastrado`
  }

  if (isMulter) {
    detail = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede o tamanho maximo permitido.' : 'Upload invalido.'
  }

  if (status >= 500) {
    detail = 'Erro interno do servidor.'
  }

  const payload =
    status < 500 && err.detail && typeof err.detail === 'object'
      ? { ...err.detail }
      : {
          error: status >= 500 ? 'internal_server_error' : 'request_error',
          detail,
        }

  if (status < 500 && !payload.path) payload.path = req.path

  const logDetail = status >= 500 ? err.message || 'internal_server_error' : detail
  console.error(`[ERROR] ${req.method} ${req.path} -> ${status}: ${logDetail}`)

  res.status(status).json(payload)
}
