'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const XLSX = require('xlsx')

const { buildProfessionalExcel, buildProfessionalPdf } = require('../src/services/professionalReports')
const { buildReportSnapshot, statusFinal } = require('../src/services/reportSnapshot')

const projeto = {
  _id: '507f1f77bcf86cd799439011',
  nome: 'Edificio Aurora',
  cliente: 'Aurora Engenharia',
  uf: 'SP',
  cidade: 'Campinas',
  concessionaria: 'CPFL Paulista',
  tensao_ref: 380,
  revisao: '03',
  responsavelTecnico: 'Eng. Gustavo',
  descricao: 'Memorial para validacao tecnica.',
}

const circuitoOk = {
  _id: '507f1f77bcf86cd799439012',
  tag: 'C-01',
  descricao: 'Iluminacao terreo',
  from_barramento: 'QD-01',
  potencia_kw: 1.1,
  tensao: 220,
  fases: 1,
  fator_potencia: 0.92,
  distancia_m: 22,
  corrente_projeto: 5.1,
  ampacidade: 24,
  secao_mm2: 2.5,
  queda_tensao_pct: 1.8,
  queda_tensao_max: 4,
  disjuntor_a: 10,
  disjuntor_icu: 6,
  status_final: 'OK',
}

const circuitoMt = {
  ...circuitoOk,
  _id: '507f1f77bcf86cd799439013',
  tag: 'MT-01',
  descricao: 'Alimentador media tensao',
  tensao: 13800,
  tensao_unidade: 'kV',
  status_final: 'ALERTA',
  validacao_mensagem: 'ΔV% do trecho está próxima do limite.',
  metadados_calculo: {
    tensao: {
      valor_informado: 13.8,
      unidade: 'kV',
      tensao_v: 13800,
      tensao_kv: 13.8,
      tipo_sistema: 'AC',
      referencia: 'fase_fase',
      classificacao: 'MT',
      contexto_aplicacao: 'industrial',
    },
  },
}

test('report snapshot contains project data, premises, alerts and immutable hash', () => {
  const snapshot = buildReportSnapshot({
    projeto,
    circuitos: [{ ...circuitoOk, status_final: 'CRITICO', validacao_mensagem: 'Queda acima do limite.' }],
    requestedMode: 'preliminar',
  })

  assert.equal(snapshot.project.nome, 'Edificio Aurora')
  assert.equal(snapshot.project.cliente, 'Aurora Engenharia')
  assert.equal(snapshot.document_status, 'PRELIMINAR')
  assert.equal(snapshot.final_released, false)
  assert.equal(snapshot.summary.bloqueados, 1)
  assert.match(snapshot.summary.bloqueios.join(' '), /Queda acima do limite/)
  assert.match(snapshot.premissas.join(' '), /apoio técnico/i)
  assert.equal(snapshot.input_hash.length, 64)
  assert.doesNotMatch(JSON.stringify(snapshot), /PROJETO APROVADO|100% conforme|sem margem de erro/i)
})

test('final report is released only without blocking items and required fields missing', () => {
  const finalSnapshot = buildReportSnapshot({ projeto, circuitos: [circuitoOk], requestedMode: 'final' })
  const blockedSnapshot = buildReportSnapshot({
    projeto: { ...projeto, cliente: '' },
    circuitos: [{ ...circuitoOk, status_final: 'CRITICO' }],
    requestedMode: 'final',
  })

  assert.equal(finalSnapshot.document_status, 'FINAL')
  assert.equal(finalSnapshot.final_released, true)
  assert.equal(blockedSnapshot.document_status, 'PRELIMINAR')
  assert.equal(blockedSnapshot.final_released, false)
})

test('Excel report has professional sheets and uses the same snapshot hash', () => {
  const snapshot = buildReportSnapshot({ projeto, circuitos: [circuitoOk], requestedMode: 'final' })
  const buffer = buildProfessionalExcel(snapshot)
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  assert.deepEqual(workbook.SheetNames, [
    'Controle',
    'Projeto',
    'Premissas',
    'Circuitos',
    'Critérios',
    'Memorial detalhado',
    'Alertas',
    'Limitações',
    'Validação',
    'Fontes Referências',
  ])

  const controle = XLSX.utils.sheet_to_json(workbook.Sheets.Controle, { header: 1 })
  const circuitos = XLSX.utils.sheet_to_json(workbook.Sheets.Circuitos, { header: 1 })
  assert.equal(controle[3][1], snapshot.input_hash)
  assert.equal(circuitos[0][5], 'Tensão')
  assert.equal(circuitos[0][9], 'Classificação')
  assert.equal(circuitos[1][18], snapshot.input_hash)
})

test('snapshot and Excel preserve informed kV voltage instead of mixing normalized volts with kV', () => {
  const snapshot = buildReportSnapshot({ projeto, circuitos: [circuitoMt], requestedMode: 'preliminar' })
  const circuit = snapshot.circuits[0]

  assert.equal(circuit.dados_informados.tensao, 13.8)
  assert.equal(circuit.dados_informados.tensao_unidade, 'kV')
  assert.equal(circuit.dados_informados.tensao_v, 13800)
  assert.equal(circuit.dados_informados.classificacao_tensao, 'MT')

  const buffer = buildProfessionalExcel(snapshot)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const circuitos = XLSX.utils.sheet_to_json(workbook.Sheets.Circuitos, { header: 1 })
  assert.equal(circuitos[1][5], 13.8)
  assert.equal(circuitos[1][6], 'kV')
})

test('PDF report is generated from the same snapshot and avoids approval language', async () => {
  const snapshot = buildReportSnapshot({ projeto, circuitos: [circuitoOk], requestedMode: 'final' })
  const buffer = await buildProfessionalPdf(snapshot)
  const text = buffer.toString('latin1')

  assert.equal(buffer.slice(0, 4).toString(), '%PDF')
  assert.doesNotMatch(text, /PROJETO APROVADO|100% conforme|sem margem de erro/i)
  assert.equal(snapshot.input_hash.length, 64)
  assert.equal(snapshot.project.nome, 'Edificio Aurora')
})

test('PDF report sanitizes technical symbols that are unsafe for the default PDF font', async () => {
  const snapshot = buildReportSnapshot({ projeto, circuitos: [circuitoMt], requestedMode: 'preliminar' })
  const buffer = await buildProfessionalPdf(snapshot)
  const raw = buffer.toString('latin1')
  const textRuns = Array.from(raw.matchAll(/<([a-f0-9]+)>/gi), (match) => Buffer.from(match[1], 'hex').toString('latin1')).join('')

  assert.match(textRuns, /13\.80 kV/)
  assert.match(textRuns, /DeltaV% do trecho/)
  assert.doesNotMatch(textRuns, /13800 kV/)
})

test('statusFinal maps report statuses safely', () => {
  assert.equal(statusFinal('OK'), 'OK')
  assert.equal(statusFinal('CRITICO'), 'BLOQUEADO')
  assert.equal(statusFinal('BLOCKED'), 'BLOQUEADO')
  assert.equal(statusFinal('ALERTA'), 'ALERTA')
  assert.equal(statusFinal('PENDENTE'), 'INCOMPLETO')
  assert.equal(statusFinal(''), 'NAO_AVALIADO')
})

test('Free preliminary PDF includes content before the stream closes and supports watermark', async () => {
  const snapshot = buildReportSnapshot({
    projeto,
    circuitos: [{ ...circuitoOk, status_final: 'BLOCKED' }],
    requestedMode: 'final',
  })
  snapshot.watermark = true
  assert.equal(snapshot.document_status, 'PRELIMINAR')
  assert.equal(snapshot.final_released, false)
  const buffer = await buildProfessionalPdf(snapshot)
  const raw = buffer.toString('latin1')
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF')
  assert.match(raw, /%%EOF/)
  assert.ok(buffer.length > 5000, 'PDF must include the report, not only an empty page')
  // PDFKit writes text as hex-encoded text runs when compression is disabled.
  const textRuns = Array.from(raw.matchAll(/<([a-f0-9]+)>/gi), (match) => Buffer.from(match[1], 'hex').toString('latin1')).join('')
  assert.match(textRuns, /Edificio Aurora/)
  assert.match(textRuns, /PLANO FREE/)
})
