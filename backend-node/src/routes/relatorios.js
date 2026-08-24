'use strict'

const router = require('express').Router()

const Projeto = require('../models/Projeto')
const Circuito = require('../models/Circuito')
const requireAuth = require('../middleware/auth')
const { reportRateLimit } = require('../middleware/apiRateLimit')
const { buildReportSnapshot } = require('../services/reportSnapshot')
const { buildProfessionalExcel, buildProfessionalPdf } = require('../services/professionalReports')
const { assertObjectId } = require('../utils/validation')
const { assertUsageAllowed, consumeUsage, usageHeadersFromContext } = require('../services/usage')

router.use(requireAuth)

function safeFilename(text) {
  return String(text || 'projeto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'projeto'
}

router.get('/:projetoId/:tipo', reportRateLimit, async (req, res, next) => {
  try {
    const { projetoId, tipo } = req.params
    const modo = String(req.query.modo || 'final').toLowerCase()
    const projetoObjectId = assertObjectId(projetoId, 'projetoId')
    if (!['pdf', 'excel'].includes(tipo)) {
      return res.status(400).json({ detail: 'Tipo de relatorio invalido. Use pdf ou excel.' })
    }
    if (!['final', 'preliminar'].includes(modo)) {
      return res.status(400).json({ detail: 'Modo de relatorio invalido. Use final ou preliminar.' })
    }

    const projeto = await Projeto.findOne({ _id: projetoObjectId, usuarioId: req.user._id }).lean()
    if (!projeto) return res.status(404).json({ detail: 'Projeto nao encontrado' })
    const feature = tipo === 'pdf' ? 'pdf_export' : 'excel_export'
    const usageContext = await assertUsageAllowed(req.user, feature)

    const circuitos = await Circuito.find({ projetoId: projeto._id }).sort({ ordem: 1 }).lean()

    const snapshot = buildReportSnapshot({
      projeto,
      circuitos,
      usuario: {
        nome: req.user.nome,
        email: req.user.email,
        crea: req.user.crea,
        empresa: req.user.empresa,
      },
      requestedMode: modo,
    })
    snapshot.watermark = Boolean(usageContext.plan.features.watermark_free_reports && tipo === 'pdf')

    if (modo === 'final' && !snapshot.final_released) {
      return res.status(409).json({
        error: 'final_report_blocked',
        detail: 'Relatorio final bloqueado. Gere relatorio preliminar ou corrija as pendencias.',
        bloqueios: snapshot.summary.bloqueios,
        avisos: snapshot.summary.avisos,
      })
    }

    const buffer = tipo === 'pdf'
      ? await buildProfessionalPdf(snapshot)
      : buildProfessionalExcel(snapshot)
    await consumeUsage(req.user, tipo === 'pdf' ? { pdfExports: 1 } : { excelExports: 1 })

    const contentType = tipo === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const extension = tipo === 'pdf' ? 'pdf' : 'xlsx'
    const status = snapshot.document_status.toLowerCase()
    const filename = `calccabos_${safeFilename(projeto.nome || projetoId)}_${status}.${extension}`

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-CalcCabos-Input-Hash', snapshot.input_hash)
    res.setHeader('X-CalcCabos-Document-Status', snapshot.document_status)
    res.setHeader('X-CalcCabos-Watermark', snapshot.watermark ? 'true' : 'false')
    Object.entries(usageHeadersFromContext(usageContext)).forEach(([key, value]) => res.setHeader(key, value))
    return res.send(buffer)
  } catch (err) {
    if (err.message && /Cast to ObjectId|ObjectId/.test(err.message)) {
      return res.status(400).json({ detail: 'Identificador de projeto invalido.' })
    }
    return next(err)
  }
})

module.exports = router
module.exports._internal = { safeFilename }
