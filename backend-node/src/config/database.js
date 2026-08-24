'use strict'

const mongoose = require('mongoose')

let mongoMemoryServer = null

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}

async function connect() {
  let uri = process.env.MONGODB_URI

  if (!uri) {
    console.log('[DB] MONGODB_URI nao fornecida. Iniciando MongoDB Memory Server para ambiente local...')
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server')
      mongoMemoryServer = await MongoMemoryServer.create()
      uri = mongoMemoryServer.getUri()
      console.log(`[DB] MongoDB Memory Server rodando em: ${uri}`)
    } catch (err) {
      console.error('[DB] Erro ao iniciar MongoMemoryServer:', err.message)
      process.exit(1)
    }
  }

  try {
    await mongoose.connect(uri, options)
    console.log('[DB] MongoDB conectado com sucesso')
  } catch (err) {
    console.error('[DB] Conexao falhou:', err.message)
    process.exit(1)
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB desconectado')
})

mongoose.connection.on('reconnected', () => {
  console.log('[DB] MongoDB reconectado')
})

module.exports = { connect }
