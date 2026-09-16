'use strict'

const express = require('express')
const fs = require('node:fs')
const path = require('node:path')

const FRONTEND_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

module.exports = function serveFrontend(directory = path.resolve(__dirname, '../../../frontend/dist')) {
  const router = express.Router()
  const indexFile = path.join(directory, 'index.html')
  if (!fs.existsSync(indexFile)) return router

  // API misses and private paths must never fall through to the SPA.
  router.use((req, _res, next) => {
    if (/^\/(api|health)(\/|$)/.test(req.path) || req.path.split('/').some((part) => part.startsWith('.'))) {
      return next('router')
    }
    next()
  })
  router.use(express.static(directory, {
    dotfiles: 'deny',
    setHeaders(res, file) {
      res.setHeader('Content-Security-Policy', FRONTEND_CSP)
      if (path.basename(file) === 'index.html') res.setHeader('Cache-Control', 'no-store')
    },
  }))
  router.get('*', (req, res, next) => {
    if (path.extname(req.path) || !req.accepts('html')) return next()
    res.setHeader('Content-Security-Policy', FRONTEND_CSP)
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(indexFile)
  })
  return router
}
