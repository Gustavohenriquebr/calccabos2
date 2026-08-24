'use strict'

const mongoose = require('mongoose')

let mongoMemoryServer = null

const DEFAULT_APP_NAME = 'CalcCabos API'

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined
  return String(value).trim().toLowerCase() === 'true'
}

function assertValidMongoUri(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('MONGODB_URI obrigatoria em producao.')
  }

  const trimmed = uri.trim()
  if (!/^mongodb(\+srv)?:\/\//i.test(trimmed)) {
    throw new Error('MONGODB_URI invalida. Use mongodb:// ou mongodb+srv://.')
  }

  if (/\s/.test(trimmed)) {
    throw new Error('MONGODB_URI invalida. Remova espacos em branco.')
  }

  return trimmed
}

function resolveMongoConfig(env = process.env) {
  const rawUri = String(env.MONGODB_URI || '').trim()
  const dbName = String(env.MONGODB_DB_NAME || '').trim() || undefined
  const appName = String(env.MONGODB_APP_NAME || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME
  const tls = parseBoolean(env.MONGODB_TLS)

  if (!rawUri) {
    if (env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI obrigatoria em producao.')
    }
    return {
      mode: 'memory',
      uri: null,
      options: {
        appName,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        ...(dbName ? { dbName } : {}),
        ...(tls !== undefined ? { tls } : {}),
      },
    }
  }

  return {
    mode: 'external',
    uri: assertValidMongoUri(rawUri),
    options: {
      appName,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      ...(dbName ? { dbName } : {}),
      ...(tls !== undefined ? { tls } : {}),
    },
  }
}

async function connect() {
  const config = resolveMongoConfig()
  let uri = config.uri

  if (!uri) {
    console.warn('[DB] MONGODB_URI ausente. Iniciando MongoDB Memory Server apenas para desenvolvimento local.')
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server')
      mongoMemoryServer = await MongoMemoryServer.create()
      uri = mongoMemoryServer.getUri()
      console.log('[DB] MongoDB Memory Server iniciado para ambiente local.')
    } catch (err) {
      console.error('[DB] Erro ao iniciar MongoMemoryServer local:', err.message)
      process.exit(1)
    }
  }

  try {
    await mongoose.connect(uri, config.options)
    console.log(`[DB] MongoDB conectado com sucesso (${config.mode === 'memory' ? 'local-memory' : 'env'}).`)
  } catch (err) {
    console.error('[DB] Conexao MongoDB falhou:', isProduction() ? 'verifique MONGODB_URI e acesso de rede.' : err.message)
    process.exit(1)
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB desconectado')
})

mongoose.connection.on('reconnected', () => {
  console.log('[DB] MongoDB reconectado')
})

module.exports = { assertValidMongoUri, connect, resolveMongoConfig }
