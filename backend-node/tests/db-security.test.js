'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const mongoose = require('mongoose')

const { assertValidMongoUri, resolveMongoConfig } = require('../src/config/database')
const User = require('../src/models/User')
const Projeto = require('../src/models/Projeto')
const Circuito = require('../src/models/Circuito')
const circuitosRouter = require('../src/routes/circuitos')
const ProjetoRevision = require('../src/models/ProjetoRevision')

test('Mongo config requires MONGODB_URI in production', () => {
  assert.throws(
    () => resolveMongoConfig({ NODE_ENV: 'production' }),
    /MONGODB_URI obrigatoria em producao/
  )
})

test('Mongo config accepts Atlas URI without exposing it in options', () => {
  const cfg = resolveMongoConfig({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://example.mongodb.net/calccabos',
    MONGODB_DB_NAME: 'calccabos',
    MONGODB_APP_NAME: 'CalcCabos Tests',
    MONGODB_TLS: 'true',
  })

  assert.equal(cfg.mode, 'external')
  assert.equal(cfg.options.dbName, 'calccabos')
  assert.equal(cfg.options.appName, 'CalcCabos Tests')
  assert.equal(cfg.options.tls, true)
  assert.doesNotMatch(JSON.stringify(cfg.options), /user:pass/)
})

test('Mongo URI validator rejects non-Mongo schemes', () => {
  assert.throws(() => assertValidMongoUri('https://example.com'), /MONGODB_URI invalida/)
})

test('User schema keeps senhaHash private on JSON serialization', () => {
  const user = new User({
    nome: 'Engenheiro Teste',
    email: 'teste@example.com',
    senhaHash: 'hash-seguro',
  })

  const json = user.toJSON()
  assert.equal(User.schema.path('senhaHash').options.select, false)
  assert.equal(json.senhaHash, undefined)
  assert.equal(json.email, 'teste@example.com')
})

test('User schema declares unique email index', () => {
  const hasUniqueEmail = User.schema.indexes().some(([fields, options]) => fields.email === 1 && options.unique)
  assert.equal(hasUniqueEmail, true)
})

test('Projeto requires immutable usuarioId owner', () => {
  const projeto = new Projeto({ nome: 'Projeto sem dono' })
  const err = projeto.validateSync()
  assert.match(err.message, /usuarioId/)
  assert.equal(Projeto.schema.path('usuarioId').options.immutable, true)
})

test('Projeto persists revision and revision history keeps ownership immutable', () => {
  assert.equal(Projeto.schema.path('revisao').options.default, '0')
  assert.equal(ProjetoRevision.schema.path('projetoId').options.immutable, true)
  assert.equal(ProjetoRevision.schema.path('usuarioId').options.immutable, true)
  assert.equal(ProjetoRevision.schema.indexes().some(([fields]) => fields.projetoId === 1 && fields.criado_em === -1), true)
})

test('Projeto supports universal locality data and high-voltage reference values', () => {
  const projeto = new Projeto({
    nome: 'Subestação de transmissão',
    usuarioId: new mongoose.Types.ObjectId(),
    uf: 'SP',
    cidade: 'Campinas',
    concessionaria: 'Concessionária de teste',
    contexto: 'transmissao',
    tensao_ref: 1000000,
  })
  assert.equal(projeto.validateSync(), undefined)
  assert.equal(projeto.uf, 'SP')
  assert.equal(projeto.tensao_ref, 1000000)
})

test('Circuito requires project and rejects invalid negative engineering values', () => {
  const circuito = new Circuito({
    descricao: 'Circuito invalido',
    potencia_kw: -1,
    distancia_m: 10,
  })
  const err = circuito.validateSync()
  assert.match(err.message, /projetoId/)
  assert.match(err.message, /potencia_kw/)
})

test('Circuito has owner traversal indexes by projetoId', () => {
  const indexes = Circuito.schema.indexes()
  assert.equal(indexes.some(([fields]) => fields.projetoId === 1 && fields.ordem === 1), true)
  assert.equal(indexes.some(([fields]) => fields.projetoId === 1 && fields.status_final === 1), true)
})

test('Circuito preserves tempo de atuacao from the API input allowlist', () => {
  const projetoId = new mongoose.Types.ObjectId()
  const normalized = circuitosRouter._internal.normalizarEntrada({
    descricao: 'Teste de protecao',
    tensao: 380,
    potencia_kw: 10,
    distancia_m: 20,
    tempo_atuacao: 0.1,
  }, projetoId)

  assert.equal(normalized.tempo_atuacao, 0.1)
})

test.after(() => {
  mongoose.deleteModel(/.+/)
})
