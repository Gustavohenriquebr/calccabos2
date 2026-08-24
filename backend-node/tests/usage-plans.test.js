'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

let mongo

test.before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri(), { dbName: 'usage-plans-test' })
})

test.after(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
})

test.beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})))
})

const User = require('../src/models/User')
const Projeto = require('../src/models/Projeto')
const Circuito = require('../src/models/Circuito')
const Usage = require('../src/models/Usage')
const { PLANS } = require('../src/config/plans')
const {
  assertUsageAllowed,
  consumeUsage,
  currentPeriod,
  getUsageContext,
} = require('../src/services/usage')

async function createUser(plan = 'free') {
  return User.create({
    nome: `Usuario ${plan}`,
    email: `${plan}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    senhaHash: 'hash-seguro',
    plan,
  })
}

async function createProject(user, nome = 'Projeto') {
  return Projeto.create({
    usuarioId: user._id,
    nome,
    contexto: 'industrial',
    tensao_ref: 380,
  })
}

async function createCircuit(projeto, index = 1) {
  return Circuito.create({
    projetoId: projeto._id,
    descricao: `Circuito ${index}`,
    potencia_kw: 1,
    distancia_m: 10,
    tensao: 220,
  })
}

test('Free com menos de 2 projetos pode criar projeto', async () => {
  const user = await createUser('free')
  await createProject(user, 'P1')

  const context = await assertUsageAllowed(user.toObject(), 'projects.create')

  assert.equal(context.usage.activeProjects, 1)
  assert.equal(context.plan.id, 'free')
})

test('Free com 2 projetos ativos nao pode criar terceiro', async () => {
  const user = await createUser('free')
  await createProject(user, 'P1')
  await createProject(user, 'P2')

  await assert.rejects(
    () => assertUsageAllowed(user.toObject(), 'projects.create'),
    (err) => {
      assert.equal(err.status, 402)
      assert.equal(err.detail.code, 'USAGE_LIMIT_EXCEEDED')
      assert.equal(err.detail.feature, 'projects.create')
      assert.equal(err.detail.currentUsage, 2)
      assert.equal(err.detail.limit, 2)
      return true
    }
  )
})

test('Free nao pode passar de 20 circuitos no mesmo projeto', async () => {
  const user = await createUser('free')
  const projeto = await createProject(user)
  await Promise.all(Array.from({ length: 20 }, (_, index) => createCircuit(projeto, index + 1)))

  await assert.rejects(
    () => assertUsageAllowed(user.toObject(), 'circuits.create', { projetoId: projeto._id }),
    /20 circuitos por projeto/
  )
})

test('Free pode gerar PDF ate 3 vezes no mes e excedente retorna erro estruturado', async () => {
  const user = await createUser('free')

  await Usage.create({ userId: user._id, period: currentPeriod(), pdfExports: 2 })
  await assertUsageAllowed(user.toObject(), 'pdf_export')
  await consumeUsage(user.toObject(), { pdfExports: 1 })

  const context = await getUsageContext(user.toObject())
  assert.equal(context.usage.pdfExports, 3)

  await assert.rejects(
    () => assertUsageAllowed(user.toObject(), 'pdf_export'),
    (err) => {
      assert.equal(err.status, 402)
      assert.equal(err.detail.feature, 'pdf_export')
      assert.equal(err.detail.currentUsage, 3)
      assert.equal(err.detail.limit, 3)
      assert.equal(err.detail.plan, 'free')
      assert.equal(err.detail.recommendedPlan, 'estudante')
      return true
    }
  )
})

test('Estudante e Pro possuem limites maiores que Free', () => {
  assert.ok(PLANS.estudante.limits.activeProjects > PLANS.free.limits.activeProjects)
  assert.ok(PLANS.estudante.limits.circuitsPerProject > PLANS.free.limits.circuitsPerProject)
  assert.ok(PLANS.pro.limits.pdfExports > PLANS.estudante.limits.pdfExports)
  assert.ok(PLANS.pro.limits.importedRows > PLANS.estudante.limits.importedRows)
})

test('Feature flag desativada bloqueia recurso premium', async () => {
  const user = await createUser('free')

  await assert.rejects(
    () => assertUsageAllowed(user.toObject(), 'unifilar_export'),
    (err) => {
      assert.equal(err.status, 402)
      assert.equal(err.detail.code, 'FEATURE_NOT_AVAILABLE')
      assert.equal(err.detail.feature, 'unifilar_export')
      assert.equal(err.detail.plan, 'free')
      assert.equal(err.detail.recommendedPlan, 'pro')
      return true
    }
  )
})

test('Importacao respeita limite mensal de linhas do plano Free', async () => {
  const user = await createUser('free')
  await Usage.create({ userId: user._id, period: currentPeriod(), importedRows: 45 })

  await assert.rejects(
    () => assertUsageAllowed(user.toObject(), 'imported_rows', { amount: 10 }),
    (err) => {
      assert.equal(err.detail.feature, 'imported_rows')
      assert.equal(err.detail.currentUsage, 45)
      assert.equal(err.detail.limit, 50)
      return true
    }
  )
})
