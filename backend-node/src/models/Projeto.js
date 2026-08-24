'use strict'

const mongoose = require('mongoose')

const ProjetoSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },
    nome:      { type: String, required: true, trim: true, maxlength: 200 },
    descricao: { type: String, default: null, trim: true, maxlength: 2000 },
    cliente:   { type: String, default: null, trim: true, maxlength: 200 },
    contexto:  {
      type: String,
      enum: ['industrial', 'offshore', 'hospitalar', 'residencial'],
      default: 'industrial',
    },
    tensao_ref: { type: Number, default: 380, min: 1, max: 100000 },

    // Módulos calculados — armazenados como JSON livre (espelho dos campos Python)
    transformador_dados:       { type: mongoose.Schema.Types.Mixed, default: null },
    sistema_trifasico_dados:   { type: mongoose.Schema.Types.Mixed, default: null },
    protecao_geral_dados:      { type: mongoose.Schema.Types.Mixed, default: null },
    para_raios_dados:          { type: mongoose.Schema.Types.Mixed, default: null },
    aterramento_dados:         { type: mongoose.Schema.Types.Mixed, default: null },
    areas_classificadas_dados: { type: mongoose.Schema.Types.Mixed, default: null },

    // Campos extras N-2040
    normaVersao:        { type: String, default: 'NBR 5410:2004', trim: true, maxlength: 80 },
    responsavelTecnico: { type: String, default: null, trim: true, maxlength: 200 },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Dashboard: WHERE usuarioId = ? ORDER BY criado_em DESC
ProjetoSchema.index({ usuarioId: 1, criado_em: -1 })
ProjetoSchema.index({ usuarioId: 1, atualizado_em: -1 })

module.exports = mongoose.model('Projeto', ProjetoSchema)
