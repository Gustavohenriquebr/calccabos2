'use strict'

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function asPositiveInt(value, fallback, { min = 1, max = 8000 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function resolveAiConfig(env = process.env) {
  const provider = String(env.AI_PROVIDER || 'openai').trim().toLowerCase()
  const enabled = asBool(env.AI_ENABLED, false)
  const model = String(env.AI_MODEL || 'gpt-5.6').trim()
  const maxTokens = asPositiveInt(env.AI_MAX_TOKENS, 900, { min: 200, max: 4000 })
  const timeoutMs = asPositiveInt(env.AI_TIMEOUT_MS, 45000, { min: 5000, max: 120000 })
  const apiKey = String(env.OPENAI_API_KEY || '').trim()

  return {
    enabled,
    provider,
    model,
    maxTokens,
    timeoutMs,
    apiKey,
    hasApiKey: Boolean(apiKey),
  }
}

function aiUnavailable(message, status = 503) {
  const err = new Error(message)
  err.status = status
  err.detail = {
    error: 'ai_unavailable',
    detail: message,
  }
  return err
}

module.exports = {
  resolveAiConfig,
  aiUnavailable,
}
