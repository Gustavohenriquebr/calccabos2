'use strict'

function errorText(err) {
  const upstream = err?.detail?.upstream
  if (upstream?.reason) return typeof upstream.reason === 'string' ? upstream.reason : JSON.stringify(upstream.reason)
  if (err?.response?.data?.detail) return String(err.response.data.detail)
  if (err?.response?.data?.error) return String(err.response.data.error)
  if (err?.message) return err.message
  return 'Erro desconhecido'
}

module.exports = {
  errorText,
}
