'use strict'

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const UserSchema = new mongoose.Schema(
  {
    nome:      { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    email:     {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail invalido'],
    },
    senhaHash: { type: String, required: true, select: false },
    crea:      { type: String, default: null, trim: true, maxlength: 50 },
    empresa:   { type: String, default: null, trim: true, maxlength: 150 },
    plan: {
      type: String,
      enum: ['free', 'estudante', 'pro'],
      default: 'free',
      index: true,
    },
    planStatus: {
      type: String,
      enum: ['active', 'trialing', 'paused', 'blocked'],
      default: 'active',
      index: true,
    },
    trialEndsAt: { type: Date, default: null },
    limitsOverride: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.senhaHash
        delete ret.__v
        return ret
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.senhaHash
        delete ret.__v
        return ret
      },
    },
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
    plan: this.plan || 'free',
    planStatus: this.planStatus || 'active',
    trialEndsAt: this.trialEndsAt || null,
  }
}

module.exports = mongoose.model('User', UserSchema)
