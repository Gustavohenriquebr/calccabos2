'use strict'

const Circuito = require('../models/Circuito')
const Projeto = require('../models/Projeto')
const Usage = require('../models/Usage')
const {
  FEATURE_FLAGS,
  getPlan,
  normalizePlan,
  publicPlan,
  recommendedPlanFor,
} = require('../config/plans')

const USAGE_FIELDS = new Set(['pdfExports', 'excelExports', 'aiMessages', 'spreadsheetImports', 'importedRows'])

function currentPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function getUserPlanId(user) {
  if (!user || String(user.planStatus || 'active') === 'blocked') return 'free'
  return normalizePlan(user.plan)
}

function mergePlanWithOverrides(user) {
  const base = publicPlan(getUserPlanId(user))
  const overrides = user?.limitsOverride && typeof user.limitsOverride === 'object' ? user.limitsOverride : {}
  return {
    ...base,
    limits: { ...base.limits, ...(overrides.limits || {}) },
    features: { ...base.features, ...(overrides.features || {}) },
  }
}

async function getOrCreateUsage(userId, period = currentPeriod()) {
  return Usage.findOneAndUpdate(
    { userId, period },
    { $setOnInsert: { userId, period } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()
}

async function getUsageContext(user, { period = currentPeriod(), projetoId = null } = {}) {
  const plan = mergePlanWithOverrides(user)
  const [usage, activeProjects, circuitsInProject] = await Promise.all([
    getOrCreateUsage(user._id, period),
    Projeto.countDocuments({ usuarioId: user._id }),
    projetoId ? Circuito.countDocuments({ projetoId }) : Promise.resolve(null),
  ])

  return {
    period,
    plan,
    usage: {
      pdfExports: usage.pdfExports || 0,
      excelExports: usage.excelExports || 0,
      aiMessages: usage.aiMessages || 0,
      spreadsheetImports: usage.spreadsheetImports || 0,
      importedRows: usage.importedRows || 0,
      activeProjects,
      circuitsInProject,
    },
  }
}

function limitError({ feature, usageKey, currentUsage, limit, plan, recommendedPlan, message }) {
  const err = new Error(message)
  err.status = 402
  err.code = 'usage_limit_exceeded'
  err.detail = {
    error: 'usage_limit_exceeded',
    code: 'USAGE_LIMIT_EXCEEDED',
    feature,
    currentUsage,
    limit,
    plan: plan.id,
    recommendedPlan,
    message,
    usageKey,
  }
  return err
}

function featureError({ feature, plan, recommendedPlan, message }) {
  const err = new Error(message)
  err.status = 402
  err.code = 'feature_not_available'
  err.detail = {
    error: 'feature_not_available',
    code: 'FEATURE_NOT_AVAILABLE',
    feature,
    currentUsage: null,
    limit: 0,
    plan: plan.id,
    recommendedPlan,
    message,
  }
  return err
}

function assertFeatureEnabled(context, feature) {
  const enabled = Boolean(context.plan.features[feature])
  if (!enabled) {
    throw featureError({
      feature,
      plan: context.plan,
      recommendedPlan: recommendedPlanFor(feature, context.plan.id),
      message: `O recurso ${feature} nao esta disponivel no plano ${context.plan.name}. O projeto continua editavel; solicite upgrade para liberar este recurso.`,
    })
  }
}

async function assertUsageAllowed(user, feature, options = {}) {
  const context = await getUsageContext(user, options)
  const amount = Math.max(1, Number(options.amount || 1))

  if (feature === 'projects.create') {
    const currentUsage = context.usage.activeProjects
    const limit = context.plan.limits.activeProjects
    if (currentUsage + amount > limit) {
      throw limitError({
        feature,
        usageKey: 'activeProjects',
        currentUsage,
        limit,
        plan: context.plan,
        recommendedPlan: recommendedPlanFor(null, context.plan.id),
        message: `Seu plano ${context.plan.name} permite ate ${limit} projetos ativos. Voce ja possui ${currentUsage}.`,
      })
    }
    return context
  }

  if (feature === 'circuits.create') {
    const currentUsage = context.usage.circuitsInProject || 0
    const limit = context.plan.limits.circuitsPerProject
    if (currentUsage + amount > limit) {
      throw limitError({
        feature,
        usageKey: 'circuitsPerProject',
        currentUsage,
        limit,
        plan: context.plan,
        recommendedPlan: recommendedPlanFor(null, context.plan.id),
        message: `Seu plano ${context.plan.name} permite ate ${limit} circuitos por projeto. Este projeto ja possui ${currentUsage}.`,
      })
    }
    return context
  }

  const map = {
    pdf_export: ['pdfExports', 'pdfExports'],
    excel_export: ['excelExports', 'excelExports'],
    ai_assistant: ['aiMessages', 'aiMessages'],
    spreadsheet_import: ['spreadsheetImports', 'spreadsheetImports'],
    imported_rows: ['importedRows', 'importedRows'],
    unifilar_export: [null, null],
  }
  const [usageKey, limitKey] = map[feature] || []

  if (Object.values(FEATURE_FLAGS).includes(feature)) assertFeatureEnabled(context, feature)
  if (feature === 'imported_rows') assertFeatureEnabled(context, FEATURE_FLAGS.spreadsheet_import)

  if (usageKey && limitKey) {
    const currentUsage = context.usage[usageKey] || 0
    const limit = context.plan.limits[limitKey]
    if (currentUsage + amount > limit) {
      throw limitError({
        feature,
        usageKey,
        currentUsage,
        limit,
        plan: context.plan,
        recommendedPlan: recommendedPlanFor(feature === 'imported_rows' ? FEATURE_FLAGS.spreadsheet_import : feature, context.plan.id),
        message: `Limite mensal do plano ${context.plan.name} atingido para ${feature}. Uso atual: ${currentUsage}/${limit}.`,
      })
    }
  }

  return context
}

async function consumeUsage(user, increments = {}) {
  const update = {}
  Object.entries(increments).forEach(([key, value]) => {
    if (USAGE_FIELDS.has(key)) update[`$inc.${key}`] = Math.max(0, Number(value || 0))
  })
  const inc = Object.fromEntries(
    Object.entries(update)
      .filter(([key]) => key.startsWith('$inc.'))
      .map(([key, value]) => [key.replace('$inc.', ''), value])
  )
  if (Object.keys(inc).length === 0) return getOrCreateUsage(user._id)
  return Usage.findOneAndUpdate(
    { userId: user._id, period: currentPeriod() },
    { $inc: inc, $setOnInsert: { userId: user._id, period: currentPeriod() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()
}

function usageHeadersFromContext(context) {
  return {
    'X-CalcCabos-Plan': context.plan.id,
    'X-CalcCabos-Usage-Period': context.period,
  }
}

module.exports = {
  assertFeatureEnabled,
  assertUsageAllowed,
  consumeUsage,
  currentPeriod,
  getUsageContext,
  getUserPlanId,
  mergePlanWithOverrides,
  usageHeadersFromContext,
}
