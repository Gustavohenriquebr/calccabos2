'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const agentRoute = require('../src/routes/agente')

const { sanitizeContext, sanitizeHistory } = agentRoute._internal

test('agent chat route is protected by authentication middleware', () => {
  const firstLayer = agentRoute.stack[0]
  const chatLayer = agentRoute.stack.find((layer) => layer.route?.path === '/chat')

  assert.equal(firstLayer.name, 'requireAuth')
  assert.ok(chatLayer, 'POST /chat route must exist')
})

test('agent history validation rejects invalid or oversized history', () => {
  assert.throws(() => sanitizeHistory('texto'), /historico deve ser uma lista/)
  assert.throws(() => sanitizeHistory(Array.from({ length: 13 }, () => ({ content: 'oi' }))), /limite de 12/)
  assert.throws(() => sanitizeHistory([{ content: 'a'.repeat(1001) }]), /excede 1000 caracteres/)
})

test('agent context validation rejects unknown fields', () => {
  assert.throws(
    () => sanitizeContext({ rota: '/projeto/1', ownerId: 'nao-deve-entrar' }),
    /Campo desconhecido/
  )
})
