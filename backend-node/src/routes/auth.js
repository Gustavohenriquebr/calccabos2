'use strict'

const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const bcrypt  = require('bcryptjs')
const multer  = require('multer')

const User       = require('../models/User')
const requireAuth = require('../middleware/auth')

const JWT_SECRET  = process.env.JWT_SECRET || 'calccabos-dev-secret'
const JWT_EXPIRES = '7d'

// multer().none() parseia multipart/form-data sem arquivos
// Necessário porque Login.jsx usa FormData (OAuth2PasswordRequestForm)
const formParser = multer().none()

function gerarToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )
}

function usuarioPublico(user) {
  return {
    id:      user._id,
    nome:    user.nome,
    email:   user.email,
    crea:    user.crea    || null,
    empresa: user.empresa || null,
  }
}

/**
 * POST /api/auth/login
 * Aceita:
 *   - multipart/form-data com campos `username` e `password` (FormData do frontend)
 *   - application/json com campos `email` e `senha`
 */
router.post('/login', formParser, async (req, res, next) => {
  try {
    const email = (req.body.username || req.body.email || '').trim().toLowerCase()
    const senha =  req.body.password || req.body.senha || ''

    if (!email || !senha) {
      return res.status(400).json({ detail: 'E-mail e senha são obrigatórios' })
    }

    const user = await User.findOne({ email })
    if (!user || !(await user.verificarSenha(senha))) {
      return res.status(401).json({ detail: 'Credenciais inválidas' })
    }

    const token = gerarToken(user)
    res.json({ access_token: token, token_type: 'bearer', usuario: usuarioPublico(user) })
  } catch (err) { next(err) }
})

/**
 * POST /api/auth/registro
 * Body JSON: { nome, email, senha, crea?, empresa? }
 */
router.post('/registro', async (req, res, next) => {
  try {
    const { nome, email, senha, crea, empresa } = req.body || {}

    if (!nome || !email || !senha) {
      return res.status(400).json({ detail: 'nome, email e senha são obrigatórios' })
    }

    const emailNorm = email.trim().toLowerCase()
    const existe = await User.findOne({ email: emailNorm })
    if (existe) return res.status(400).json({ detail: 'Email já cadastrado' })

    const senhaHash = await bcrypt.hash(senha, 12)
    const user = await User.create({ nome: nome.trim(), email: emailNorm, senhaHash, crea, empresa })

    const token = gerarToken(user)
    res.status(201).json({ access_token: token, token_type: 'bearer', usuario: usuarioPublico(user) })
  } catch (err) { next(err) }
})

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  res.json(usuarioPublico(req.user))
})

module.exports = router
