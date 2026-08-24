'use strict'

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const UserSchema = new mongoose.Schema(
  {
    nome:      { type: String, required: true, trim: true, maxlength: 200 },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true },
    crea:      { type: String, default: null },
    empresa:   { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' },
  }
)

/** Compara senha em texto claro com o hash armazenado */
UserSchema.methods.verificarSenha = function (senha) {
  return bcrypt.compare(senha, this.senhaHash)
}

/** Payload seguro para retornar ao frontend (sem hash) */
UserSchema.methods.toPublico = function () {
  return {
    id:      this._id,
    nome:    this.nome,
    email:   this.email,
    crea:    this.crea,
    empresa: this.empresa,
  }
}

module.exports = mongoose.model('User', UserSchema)
