'use strict'

const buckets = new Map()
const DEFAULT_WINDOW_MS = 15 * 60 * 1000

function normalizeEmail(req) {
  return String(req.body?.username || req.body?.email || '').trim().toLowerCase()
}

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
}

function cleanup(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

function makeAuthRateLimit({ name, max, windowMs = DEFAULT_WINDOW_MS }) {
  return function authRateLimit(req, res, next) {
    const now = Date.now()
    cleanup(now)

    const email = normalizeEmail(req) || 'sem-email'
    const key = `${name}:${getClientIp(req)}:${email}`
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs }

    bucket.count += 1
    buckets.set(key, bucket)

    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)))
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > max) {
      return res.status(429).json({
        error: 'rate_limited',
        detail: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      })
    }

    next()
  }
}

module.exports = {
  loginRateLimit: makeAuthRateLimit({ name: 'login', max: 10 }),
  registroRateLimit: makeAuthRateLimit({ name: 'registro', max: 5 }),
}
