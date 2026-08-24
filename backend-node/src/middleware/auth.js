'use strict'

const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { JWT_SECRET } = require('../config/auth')

/**
 * Middleware de autenticação JWT.
 * Extrai o token do header Authorization: Bearer <token>
 * Verifica, busca o usuário no MongoDB e anexa em req.user.
 */
module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', detail: 'Token não fornecido' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (!payload?.sub) {
      return res.status(401).json({ error: 'unauthorized', detail: 'Token inválido ou expirado' })
    }

    const user = await User.findById(payload.sub).lean()
    if (!user) {
      return res.status(401).json({ error: 'unauthorized', detail: 'Usuário não encontrado' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'unauthorized', detail: 'Token inválido ou expirado' })
  }
}
