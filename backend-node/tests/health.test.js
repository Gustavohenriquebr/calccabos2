'use strict'

const assert = require('node:assert/strict')
const { once } = require('node:events')
const test = require('node:test')
const express = require('express')
const healthRouter = require('../src/routes/health')

test('liveness probe responds without waiting for external dependencies', async (t) => {
  const app = express()
  app.use('/health', healthRouter)
  const server = app.listen(0, '127.0.0.1')
  t.after(async () => new Promise((resolve) => server.close(resolve)))
  await once(server, 'listening')

  const response = await fetch(`http://127.0.0.1:${server.address().port}/health/live`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'calccabos-backend-node',
  })
})

test('readiness route is distinct from liveness route', () => {
  assert.equal(typeof healthRouter, 'function')
  // Readiness performs dependency checks at request time; liveness remains the
  // Render probe that must never wait on MongoDB or FastAPI.
  assert.ok(healthRouter.stack.some((layer) => layer.route?.path === '/live'))
  assert.ok(healthRouter.stack.some((layer) => layer.route?.path === '/ready'))
})

test('public health payload does not expose service URLs or raw errors', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousPythonUrl = process.env.PYTHON_SERVICE_URL
  process.env.NODE_ENV = 'production'
  process.env.PYTHON_SERVICE_URL = 'http://127.0.0.1:8001'

  const app = express()
  app.use('/health', healthRouter)
  const server = app.listen(0, '127.0.0.1')
  t.after(async () => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
    if (previousPythonUrl === undefined) delete process.env.PYTHON_SERVICE_URL
    else process.env.PYTHON_SERVICE_URL = previousPythonUrl
    await new Promise((resolve) => server.close(resolve))
  })
  await once(server, 'listening')

  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`)
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.status, 'degraded')
  assert.equal(payload.python.error.code, 'python_service_url_invalid')
  assert.equal('baseUrl' in payload.python, false)
  assert.equal('pythonHealthUrl' in payload, false)
  assert.equal('detail' in payload.python.error, false)
})
