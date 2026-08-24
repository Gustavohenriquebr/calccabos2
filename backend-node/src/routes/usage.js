'use strict'

const router = require('express').Router()

const requireAuth = require('../middleware/auth')
const { FEATURE_FLAGS } = require('../config/plans')
const { assertPlainObject, asInteger, asString, validationError } = require('../utils/validation')
const { assertUsageAllowed, getUsageContext } = require('../services/usage')

router.use(requireAuth)

router.get('/current', async (req, res, next) => {
  try {
    const context = await getUsageContext(req.user)
    res.json({
      plan: context.plan,
      usage: context.usage,
      period: context.period,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/check', async (req, res, next) => {
  try {
    assertPlainObject(req.body)
    const feature = asString(req.body.feature, { label: 'feature', max: 80, required: true })
    const allowedFeatures = new Set([
      ...Object.values(FEATURE_FLAGS),
      'projects.create',
      'circuits.create',
      'imported_rows',
    ])
    if (!allowedFeatures.has(feature)) throw validationError('feature invalida.')
    const amount = asInteger(req.body.amount ?? 1, { label: 'amount', min: 1, max: 10000, nullable: false })
    const projetoId = asString(req.body.projetoId || req.body.projeto_id, { label: 'projetoId', max: 80 })
    const options = { amount }
    if (feature === 'circuits.create') options.projetoId = projetoId

    const context = await assertUsageAllowed(req.user, feature, options)
    res.json({
      allowed: true,
      feature,
      amount,
      plan: context.plan,
      usage: context.usage,
      period: context.period,
    })
  } catch (err) {
    if (err.status === 402 && err.detail) return res.status(402).json(err.detail)
    next(err)
  }
})

module.exports = router
