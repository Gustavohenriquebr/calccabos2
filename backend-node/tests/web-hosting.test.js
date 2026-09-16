'use strict'

const assert = require('node:assert/strict')
const { once } = require('node:events')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const securityHeaders = require('../src/middleware/securityHeaders')
const serveFrontend = require('../src/middleware/serveFrontend')

test('web hosting serves the built SPA without masking API errors or exposing private files', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'calccabos-web-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html><title>CalcCabos</title>')
  fs.writeFileSync(path.join(directory, 'app.js'), 'console.log("loaded")')
  fs.writeFileSync(path.join(directory, '.env'), 'PRIVATE=not-public')
  const app = express()
  app.use(securityHeaders)
  app.get('/api/auth/me', (_req, res) => res.status(401).json({ error: 'unauthorized' }))
  app.use(serveFrontend(directory))
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }))
  const server = app.listen(0, '127.0.0.1')
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
  })
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`

  for (const route of ['/', '/dashboard']) {
    const response = await fetch(base + route)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /CalcCabos/)
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  const asset = await fetch(base + '/app.js')
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('content-type'), /javascript/)

  for (const route of ['/api/missing', '/health/missing', '/missing.js', '/.env']) {
    const response = await fetch(base + route)
    assert.equal(response.status, 404, route)
    assert.deepEqual(await response.json(), { error: 'not_found' })
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/)
  }
  const unauthorized = await fetch(base + '/api/auth/me')
  assert.equal(unauthorized.status, 401)
  assert.deepEqual(await unauthorized.json(), { error: 'unauthorized' })
})
