'use strict'

const mongoose = require('mongoose')

const BLOCKED_FIELDS = new Set([
  'userId',
  'usuarioId',
  'ownerId',
  'role',
  'isAdmin',
  'createdAt',
  'updatedAt',
  'criado_em',
  'atualizado_em',
  'senhaHash',
  'passwordHash',
  'hash',
  'secret',
  'secrets',
  'token',
  'access_token',
  'status',
  'status_final',
  'validacao_status',
  'flags',
  'liberado',
])

function validationError(detail, status = 400) {
  const err = new Error(detail)
  err.status = status
  err.detail = { error: 'validation_error', detail }
  return err
}

function assertPlainObject(value, label = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError(`${label} invalido.`)
  }
}

function assertObjectId(value, label = 'id') {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
    throw validationError(`${label} invalido.`)
  }
  return String(value)
}

function rejectBlockedFields(input, path = '') {
  if (!input || typeof input !== 'object') return
  for (const [key, value] of Object.entries(input)) {
    const currentPath = path ? `${path}.${key}` : key
    if (BLOCKED_FIELDS.has(key)) {
      throw validationError(`Campo nao permitido: ${currentPath}.`)
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) rejectBlockedFields(value, currentPath)
  }
}

function ensureNoUnknownFields(input, allowedFields, label = 'body') {
  for (const key of Object.keys(input || {})) {
    if (!allowedFields.includes(key)) {
      throw validationError(`Campo desconhecido em ${label}: ${key}.`)
    }
  }
}

function asString(value, { label, max = 500, required = false, nullable = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError(`${label} e obrigatorio.`)
    return nullable ? null : ''
  }
  const text = String(value).trim()
  if (required && !text) throw validationError(`${label} e obrigatorio.`)
  if (text.length > max) throw validationError(`${label} excede ${max} caracteres.`)
  return text
}

function asNumber(value, { label, min = 0, max = Number.MAX_SAFE_INTEGER, required = false, nullable = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError(`${label} e obrigatorio.`)
    return nullable ? null : undefined
  }
  const number = Number(value)
  if (!Number.isFinite(number)) throw validationError(`${label} deve ser numerico.`)
  if (number < min || number > max) throw validationError(`${label} fora da faixa permitida.`)
  return number
}

function asInteger(value, options = {}) {
  const number = asNumber(value, options)
  if (number === null || number === undefined) return number
  if (!Number.isInteger(number)) throw validationError(`${options.label} deve ser inteiro.`)
  return number
}

function asBoolean(value, { label } = {}) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  throw validationError(`${label} deve ser booleano.`)
}

function asEnum(value, allowed, { label, required = false, fallback = undefined } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError(`${label} e obrigatorio.`)
    return fallback
  }
  const text = String(value).trim()
  if (!allowed.includes(text)) throw validationError(`${label} invalido.`)
  return text
}

function sanitizeRegexText(value, { label = 'busca', max = 80 } = {}) {
  const text = asString(value, { label, max, required: false })
  if (!text) return null
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  asBoolean,
  asEnum,
  asInteger,
  asNumber,
  asString,
  assertObjectId,
  assertPlainObject,
  ensureNoUnknownFields,
  rejectBlockedFields,
  sanitizeRegexText,
  validationError,
}
