'use strict'

const FEATURE_FLAGS = Object.freeze({
  ai_assistant: 'ai_assistant',
  pdf_export: 'pdf_export',
  excel_export: 'excel_export',
  spreadsheet_import: 'spreadsheet_import',
  unifilar_export: 'unifilar_export',
  revision_history: 'revision_history',
  team_collaboration: 'team_collaboration',
  watermark_free_reports: 'watermark_free_reports',
  advanced_validation: 'advanced_validation',
  manufacturer_library: 'manufacturer_library',
})

const PLANS = Object.freeze({
  free: {
    id: 'free',
    name: 'Free',
    target: 'Teste, estudo inicial e projetos pequenos.',
    priceHint: 'R$ 0',
    limits: {
      activeProjects: 2,
      circuitsPerProject: 20,
      pdfExports: 3,
      excelExports: 3,
      aiMessages: 5,
      spreadsheetImports: 3,
      importedRows: 50,
    },
    features: {
      ai_assistant: false,
      pdf_export: true,
      excel_export: true,
      spreadsheet_import: true,
      unifilar_export: false,
      revision_history: false,
      team_collaboration: false,
      watermark_free_reports: true,
      advanced_validation: false,
      manufacturer_library: false,
    },
  },
  estudante: {
    id: 'estudante',
    name: 'Estudante',
    target: 'Alunos, portfólio e aprendizado técnico.',
    priceHint: 'R$ 19-29/mês futuramente',
    limits: {
      activeProjects: 10,
      circuitsPerProject: 80,
      pdfExports: 20,
      excelExports: 20,
      aiMessages: 100,
      spreadsheetImports: 20,
      importedRows: 500,
    },
    features: {
      ai_assistant: true,
      pdf_export: true,
      excel_export: true,
      spreadsheet_import: true,
      unifilar_export: false,
      revision_history: true,
      team_collaboration: false,
      watermark_free_reports: false,
      advanced_validation: false,
      manufacturer_library: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    target: 'Profissional autônomo e uso comercial controlado.',
    priceHint: 'R$ 79-149/mês futuramente',
    limits: {
      activeProjects: 50,
      circuitsPerProject: 300,
      pdfExports: 200,
      excelExports: 200,
      aiMessages: 1000,
      spreadsheetImports: 200,
      importedRows: 5000,
    },
    features: {
      ai_assistant: true,
      pdf_export: true,
      excel_export: true,
      spreadsheet_import: true,
      unifilar_export: true,
      revision_history: true,
      team_collaboration: false,
      watermark_free_reports: false,
      advanced_validation: true,
      manufacturer_library: false,
    },
  },
})

const PLAN_ORDER = ['free', 'estudante', 'pro']

function normalizePlan(plan) {
  const value = String(plan || 'free').trim().toLowerCase()
  return PLANS[value] ? value : 'free'
}

function getPlan(plan) {
  return PLANS[normalizePlan(plan)]
}

function publicPlan(plan) {
  const source = getPlan(plan)
  return {
    id: source.id,
    name: source.name,
    target: source.target,
    priceHint: source.priceHint,
    limits: { ...source.limits },
    features: { ...source.features },
  }
}

function recommendedPlanFor(feature, currentPlan = 'free') {
  const currentIndex = PLAN_ORDER.indexOf(normalizePlan(currentPlan))
  return PLAN_ORDER.slice(Math.max(0, currentIndex + 1)).find((planId) => {
    const plan = PLANS[planId]
    if (feature && Object.prototype.hasOwnProperty.call(plan.features, feature) && !plan.features[feature]) {
      return false
    }
    return true
  }) || 'pro'
}

module.exports = {
  FEATURE_FLAGS,
  PLAN_ORDER,
  PLANS,
  getPlan,
  normalizePlan,
  publicPlan,
  recommendedPlanFor,
}
