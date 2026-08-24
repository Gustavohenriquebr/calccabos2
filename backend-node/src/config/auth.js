'use strict'

const crypto = require('crypto')

const MIN_SECRET_LENGTH = 32
const isProduction = process.env.NODE_ENV === 'production'

function getRequiredSecret(name) {
  const value = String(process.env[name] || '').trim()

  if (value.length >= MIN_SECRET_LENGTH) {
    return value
  }

  if (isProduction) {
    throw new Error(`${name} obrigatorio em producao e deve ter pelo menos ${MIN_SECRET_LENGTH} caracteres.`)
  }

  const generated = crypto.randomBytes(48).toString('hex')
  console.warn(
    `[AUTH] ${name} ausente ou fraco. Usando segredo temporario gerado para desenvolvimento local; tokens serao invalidados ao reiniciar.`
  )
  return generated
}

module.exports = {
  JWT_SECRET: getRequiredSecret('JWT_SECRET'),
  SESSION_SECRET: getRequiredSecret('SESSION_SECRET'),
  JWT_EXPIRES: process.env.JWT_EXPIRES || '7d',
}
