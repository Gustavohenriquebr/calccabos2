'use strict'

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const { connect } = require('./config/database')
const errorHandler = require('./middleware/errorHandler')
const { getPythonServiceConfig } = require('./config/pythonService')

const app = express()
app.set('strict routing', false)

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function wildcardToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}

const envOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const mergedOrigins = unique([...DEFAULT_CORS_ORIGINS, ...envOrigins])
const exactOrigins = mergedOrigins.filter((origin) => !origin.includes('*'))
const wildcardOrigins = mergedOrigins.filter((origin) => origin.includes('*'))
const wildcardOriginRegexes = wildcardOrigins.map(wildcardToRegex)
const vercelPreviewRegex = /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i

function isAllowedOrigin(origin) {
  if (exactOrigins.includes(origin)) return true
  if (vercelPreviewRegex.test(origin)) return true
  return wildcardOriginRegexes.some((regex) => regex.test(origin))
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite requests sem origin (curl, Render probes, server-to-server)
      if (!origin) return cb(null, true)
      if (isAllowedOrigin(origin)) return cb(null, true)
      const err = new Error(`CORS: origem nao permitida: ${origin}`)
      err.status = 403
      cb(err)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-Import-Request-Id',
      'X-Import-Batch-Index',
      'X-Import-Batch-Total',
    ],
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Normaliza trailing slash para evitar 404 em rotas equivalentes
app.use((req, _res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const queryIndex = req.url.indexOf('?')
    const pathOnly = queryIndex >= 0 ? req.url.slice(0, queryIndex) : req.url
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : ''
    req.url = `${pathOnly.replace(/\/+$/, '')}${query}`
  }
  next()
})

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
}

const healthRouter = require('./routes/health')
app.use('/health', healthRouter)
app.use('/api/health', healthRouter)
app.use('/api/auth', require('./routes/auth'))
app.use('/api/projetos', require('./routes/projetos'))
app.use('/api/circuitos', require('./routes/circuitos'))
app.use('/api/relatorios', require('./routes/relatorios'))
app.use('/api/agente', require('./routes/agente'))

app.use((_req, res) => res.status(404).json({ error: 'not_found', detail: 'Rota nao encontrada' }))
app.use(errorHandler)

const PORT = parseInt(process.env.PORT || '8000', 10)

async function start() {
  await connect()
  app.listen(PORT, '0.0.0.0', () => {
    const pythonConfig = getPythonServiceConfig()
    console.log(`[APP] CalcCabos Node.js API rodando na porta ${PORT}`)
    console.log(`[APP] Python service configured: ${!pythonConfig.missingInProduction && !pythonConfig.loopbackInProduction}`)
    console.log(
      `[APP] Python service base URL: ${
        pythonConfig.missingInProduction ? 'PYTHON_SERVICE_URL ausente' : pythonConfig.baseUrl
      }`
    )
    console.log(`[APP] CORS (origens exatas): ${exactOrigins.join(', ')}`)
    if (wildcardOrigins.length) {
      console.log(`[APP] CORS (wildcards): ${wildcardOrigins.join(', ')}`)
    }
    console.log('[APP] CORS (preview Vercel): *.vercel.app')
  })
}

start().catch((err) => {
  console.error('[FATAL]', err.message)
  process.exit(1)
})

module.exports = app
