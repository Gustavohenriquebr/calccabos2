'use strict'

const mongoose = require('mongoose')

const ProjetoRevisionSchema = new mongoose.Schema(
  {
    projetoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Projeto',
      required: true,
      immutable: true,
      index: true,
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },
    tipo: {
      type: String,
      enum: ['project_update'],
      default: 'project_update',
      immutable: true,
    },
    revisao: { type: String, required: true, trim: true, maxlength: 60 },
    camposAlterados: { type: [String], default: [] },
    antes: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
    depois: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: false },
    strict: true,
  }
)

ProjetoRevisionSchema.index({ projetoId: 1, criado_em: -1 })
ProjetoRevisionSchema.index({ usuarioId: 1, projetoId: 1, criado_em: -1 })

module.exports = mongoose.model('ProjetoRevision', ProjetoRevisionSchema)
