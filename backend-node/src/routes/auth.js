'use strict'

const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const bcrypt  = require('bcryptjs')
const multer  = require('multer')

const User       = require('../models/User')
const requireAuth = require('../middleware/auth')
const { JWT_SECRET, JWT_EXPIRES } = require('../config/auth')
const { loginRateLimit, registroRateLimit } = require('../middleware/authRateLimit')

const MIN_PASSWORD_LENGTH = 8
const WEAK_PASSWORDS = new Set([
  '12345678',
  'password',
  'password1',
  'senha123',
  'admin123',
  'calccabos',
])

// multer().none() parseia multipart/form-data sem arquivos
// Necessário porque Login.jsx usa FormData (OAuth2PasswordRequestForm)
const formParser = multer().none()

function gerarToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
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
    plan: user.plan || 'free',
    planStatus: user.planStatus || 'active',
    trialEndsAt: user.trialEndsAt || null,
  }
}

function validarSenha(senha) {
  const value = String(senha || '')
  const normalized = value.trim().toLowerCase()

  if (value.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
  }

  if (!/[A-Za-zÀ-ÿ]/.test(value) || !/\d/.test(value)) {
    return 'A senha deve conter pelo menos uma letra e um número.'
  }

  if (WEAK_PASSWORDS.has(normalized)) {
    return 'Use uma senha menos previsível.'
  }

  return null
}

/**
 * POST /api/auth/login
 * Aceita:
 *   - multipart/form-data com campos `username` e `password` (FormData do frontend)
 *   - application/json com campos `email` e `senha`
 */
router.post('/login', formParser, loginRateLimit, async (req, res, next) => {
  try {
    const email = (req.body.username || req.body.email || '').trim().toLowerCase()
    const senha =  req.body.password || req.body.senha || ''

    if (!email || !senha) {
      return res.status(400).json({ detail: 'E-mail e senha são obrigatórios' })
    }

    const user = await User.findOne({ email }).select('+senhaHash')
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
router.post('/registro', registroRateLimit, async (req, res, next) => {
  try {
    const { nome, email, senha, crea, empresa } = req.body || {}

    if (!nome || !email || !senha) {
      return res.status(400).json({ detail: 'nome, email e senha são obrigatórios' })
    }

    const erroSenha = validarSenha(senha)
    if (erroSenha) {
      return res.status(400).json({ detail: erroSenha })
    }

    const emailNorm = email.trim().toLowerCase()
    const existe = await User.findOne({ email: emailNorm })
    if (existe) return res.status(400).json({ detail: 'Não foi possível concluir o cadastro com os dados informados.' })

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
