'use strict'

const router = require('express').Router()

const requireAuth = require('../middleware/auth')
const { getUsageContext } = require('../services/usage')

router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const context = await getUsageContext(req.user)
    res.json({
      plan: context.plan.id,
      features: context.plan.features,
      limits: context.plan.limits,
      period: context.period,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
