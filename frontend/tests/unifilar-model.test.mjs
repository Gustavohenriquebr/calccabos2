import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildUnifilarModel,
  normalizeUnifilarStatus,
} from '../src/utils/unifilarModel.js'

test('buildUnifilarModel creates technical nodes and links existing circuits', () => {
  const model = buildUnifilarModel({
    projeto: {
      nome: 'Projeto Teste',
      tensao_ref: 380,
      revisao: '02',
      transformador_dados: JSON.stringify({ potencia_kva: 150, tensao_primaria: 13800, tensao_secundaria: 380 }),
    },
    circuitos: [
      {
        _id: 'circuito-1',
        tag: 'C-01',
        descricao: 'Motor bomba principal',
        from_barramento: 'QF-BMB',
        potencia_kw: 7.5,
        tensao: 380,
        corrente_projeto: 18.2,
        secao_mm2: 6,
        disjuntor_corrente_nominal: 32,
        queda_tensao_percentual: 2.1,
        status_final: 'OK',
      },
    ],
  })

  const circuitNode = model.nodes.find((node) => node.data.linkedCircuitId === 'circuito-1')
  const circuitEdge = model.edges.find((edge) => edge.data.linkedCircuitId === 'circuito-1')

  assert.equal(model.revision, '02')
  assert.ok(model.nodes.find((node) => node.id === 'entrada'))
  assert.ok(model.nodes.find((node) => node.id === 'transformador'))
  assert.ok(model.nodes.find((node) => node.id === 'qgbt'))
  assert.equal(circuitNode.type, 'motor')
  assert.equal(circuitNode.status, 'OK')
  assert.equal(circuitNode.data.tag, 'C-01')
  assert.equal(circuitEdge.status, 'OK')
})

test('normalizeUnifilarStatus maps technical states to editor states', () => {
  assert.equal(normalizeUnifilarStatus('OK'), 'OK')
  assert.equal(normalizeUnifilarStatus('ALERTA'), 'ALERTA')
  assert.equal(normalizeUnifilarStatus('CRITICO'), 'BLOQUEADO')
  assert.equal(normalizeUnifilarStatus('pendente'), 'INCOMPLETO')
  assert.equal(normalizeUnifilarStatus(''), 'NAO_AVALIADO')
})

