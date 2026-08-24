'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const securityHeaders = require('../src/middleware/securityHeaders')
const { createApiRateLimit } = require('../src/middleware/apiRateLimit')
const {
  asNumber,
  rejectBlockedFields,
  sanitizeRegexText,
  validationError,
} = require('../src/utils/validation')

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

test('security headers are applied without exposing Express internals', () => {
  const res = mockRes()
  let called = false

  securityHeaders({}, res, () => {
    called = true
  })

  assert.equal(called, true)
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(res.headers['X-Frame-Options'], 'DENY')
  assert.match(res.headers['Content-Security-Policy'], /frame-ancestors 'none'/)
})

test('blocked mass-assignment fields are rejected recursively', () => {
  assert.throws(
    () => rejectBlockedFields({ nome: 'Projeto', contexto: { ownerId: 'abc' } }),
    /Campo nao permitido: contexto.ownerId/
  )
})

test('numeric validator rejects invalid or negative values', () => {
  assert.throws(() => asNumber('abc', { label: 'potencia_kw', min: 0 }), /deve ser numerico/)
  assert.throws(() => asNumber(-1, { label: 'potencia_kw', min: 0 }), /fora da faixa/)
  assert.equal(asNumber('12.5', { label: 'potencia_kw', min: 0 }), 12.5)
})

test('regex search text is escaped before query construction', () => {
  assert.equal(sanitizeRegexText('QGBT.*[1]'), 'QGBT\\.\\*\\[1\\]')
})

test('rate limiter returns 429 after configured quota', () => {
  const limiter = createApiRateLimit({ name: 'unit-test', max: 1, windowMs: 60_000 })
  const req = { ip: '127.0.0.1', user: { _id: 'user-1' }, headers: {}, socket: {} }

  const first = mockRes()
  let firstNext = false
  limiter(req, first, () => {
    firstNext = true
  })

  const second = mockRes()
  let secondNext = false
  limiter(req, second, () => {
    secondNext = true
  })

  assert.equal(firstNext, true)
  assert.equal(secondNext, false)
  assert.equal(second.statusCode, 429)
  assert.equal(second.body.error, 'rate_limited')
})

test('validationError carries safe API payload', () => {
  const err = validationError('Campo invalido.')
  assert.equal(err.status, 400)
  assert.deepEqual(err.detail, { error: 'validation_error', detail: 'Campo invalido.' })
})
