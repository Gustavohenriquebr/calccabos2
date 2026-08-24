'use strict'

const router = require('express').Router()

const requireAuth = require('../middleware/auth')
const { PLAN_ORDER, publicPlan } = require('../config/plans')
const { getUsageContext, mergePlanWithOverrides } = require('../services/usage')

router.use(requireAuth)

router.get('/plans', (_req, res) => {
  res.json({
    plans: PLAN_ORDER.map(publicPlan),
    note: 'Pagamentos ainda nao estao habilitados. Upgrade aparece apenas como simulacao comercial.',
  })
})

router.get('/current-plan', async (req, res, next) => {
  try {
    const context = await getUsageContext(req.user)
    res.json({
      plan: mergePlanWithOverrides(req.user),
      usage: context.usage,
      period: context.period,
      billingEnabled: false,
      upgradeCta: 'Upgrade em breve',
      technicalNotice: 'CalcCabos e ferramenta de apoio tecnico. Nao substitui validacao de profissional habilitado.',
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
