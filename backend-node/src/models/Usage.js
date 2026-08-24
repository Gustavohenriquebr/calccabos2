'use strict'

const mongoose = require('mongoose')

const UsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },
    period: { type: String, required: true, index: true, maxlength: 7 },
    pdfExports: { type: Number, default: 0, min: 0 },
    excelExports: { type: Number, default: 0, min: 0 },
    aiMessages: { type: Number, default: 0, min: 0 },
    spreadsheetImports: { type: Number, default: 0, min: 0 },
    importedRows: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' },
  }
)

UsageSchema.index({ userId: 1, period: 1 }, { unique: true })

module.exports = mongoose.model('Usage', UsageSchema)
