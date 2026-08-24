'use strict'

const buckets = new Map()

function clientKey(req, name) {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const user = req.user?._id ? String(req.user._id) : 'anon'
  return `${name}:${user}:${ip}`
}

function cleanup(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

function createApiRateLimit({ name, max, windowMs }) {
  return function apiRateLimit(req, res, next) {
    const now = Date.now()
    cleanup(now)

    const key = clientKey(req, name)
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs }
    bucket.count += 1
    buckets.set(key, bucket)

    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)))
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > max) {
      return res.status(429).json({
        error: 'rate_limited',
        detail: 'Muitas requisições. Aguarde alguns minutos e tente novamente.',
      })
    }

    next()
  }
}

function envInt(name, fallback, { min = 1, max = 10000 } = {}) {
  const value = Number.parseInt(String(process.env[name] || ''), 10)
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

module.exports = {
  createApiRateLimit,
  agentRateLimit: createApiRateLimit({
    name: 'agent',
    max: envInt('AI_RATE_LIMIT', 30, { min: 1, max: 300 }),
    windowMs: 15 * 60 * 1000,
  }),
  importRateLimit: createApiRateLimit({ name: 'import', max: 20, windowMs: 15 * 60 * 1000 }),
  reportRateLimit: createApiRateLimit({ name: 'report', max: 30, windowMs: 15 * 60 * 1000 }),
  batchCalcRateLimit: createApiRateLimit({ name: 'batch-calc', max: 20, windowMs: 15 * 60 * 1000 }),
  createCircuitRateLimit: createApiRateLimit({ name: 'circuit-write', max: 120, windowMs: 15 * 60 * 1000 }),
}
