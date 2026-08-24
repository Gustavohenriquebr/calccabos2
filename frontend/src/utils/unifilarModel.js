const STATUS_MAP = [
  ['OK', 'OK'],
  ['CRITICO', 'BLOQUEADO'],
  ['CRÍTICO', 'BLOQUEADO'],
  ['BLOQUEADO', 'BLOQUEADO'],
  ['ERRO', 'BLOQUEADO'],
  ['ALERTA', 'ALERTA'],
  ['WARNING', 'ALERTA'],
  ['PENDENTE', 'INCOMPLETO'],
  ['INCOMPLETO', 'INCOMPLETO'],
  ['NAO_AVALIADO', 'NAO_AVALIADO'],
  ['NÃO AVALIADO', 'NAO_AVALIADO'],
]

export const UNIFILAR_STATUS = {
  OK: { label: 'OK', color: '#15803d', bg: '#dcfce7', stroke: '#22c55e' },
  ALERTA: { label: 'Alerta', color: '#92400e', bg: '#fef3c7', stroke: '#f59e0b' },
  BLOQUEADO: { label: 'Bloqueado', color: '#b91c1c', bg: '#fee2e2', stroke: '#ef4444' },
  NAO_AVALIADO: { label: 'Não avaliado', color: '#475569', bg: '#f1f5f9', stroke: '#94a3b8' },
  INCOMPLETO: { label: 'Incompleto', color: '#7c2d12', bg: '#ffedd5', stroke: '#fb923c' },
}

export const UNIFILAR_LIBRARY = [
  { type: 'entrada', label: 'Entrada', description: 'Ponto de entrega / concessionária' },
  { type: 'transformador', label: 'Transformador', description: 'Fonte ou transformação' },
  { type: 'qgbt', label: 'QGBT', description: 'Quadro geral de baixa tensão' },
  { type: 'quadro', label: 'Quadro', description: 'Quadro derivado' },
  { type: 'disjuntor', label: 'Disjuntor', description: 'Proteção de circuito' },
  { type: 'circuito', label: 'Circuito', description: 'Ramal ou circuito final' },
  { type: 'motor', label: 'Motor', description: 'Carga motriz' },
  { type: 'iluminacao', label: 'Iluminação', description: 'Carga de iluminação' },
  { type: 'tomadas', label: 'Tomadas', description: 'Tomadas de uso geral/específico' },
  { type: 'carga', label: 'Carga genérica', description: 'Equipamento ou reserva' },
]

export function normalizeUnifilarStatus(status) {
  const text = String(status || '').trim().toUpperCase()
  if (!text) return 'NAO_AVALIADO'
  const found = STATUS_MAP.find(([needle]) => text.includes(needle))
  return found ? found[1] : 'NAO_AVALIADO'
}

export function fmtEngineeringValue(value, suffix = '', decimals = 2) {
  if (value === null || value === undefined || value === '') return 'N/D'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  const text = Number.isInteger(number) ? String(number) : number.toFixed(decimals)
  return `${text}${suffix}`
}

export function parseJsonField(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function circuitType(circuit) {
  const text = `${circuit?.tipo_carga || ''} ${circuit?.descricao || ''}`.toLowerCase()
  if (text.includes('motor') || text.includes('bomba')) return 'motor'
  if (text.includes('ilum')) return 'iluminacao'
  if (text.includes('tomada') || text.includes('tug') || text.includes('tue')) return 'tomadas'
  return 'carga'
}

function circuitBoard(circuit) {
  return circuit?.quadro || circuit?.from_barramento || circuit?.origem || 'QGBT'
}

function circuitProtection(circuit) {
  const current = circuit?.disjuntor_sugerido_in || circuit?.disjuntor_corrente_nominal || circuit?.disjuntor_a
  const icu = circuit?.disjuntor_sugerido_icu || circuit?.disjuntor_icu
  const curve = circuit?.disjuntor_sugerido_curva || circuit?.disjuntor_curva
  if (!current && !icu && !curve) return 'N/D'
  return [fmtEngineeringValue(current, ' A', 0), fmtEngineeringValue(icu, ' kA', 1), curve].filter(Boolean).join(' / ')
}

function circuitCable(circuit) {
  return circuit?.cabo_sugerido_tipo_comercial
    || circuit?.tipo_cabo_comercial
    || (circuit?.secao_mm2 ? `${fmtEngineeringValue(circuit.secao_mm2, ' mm2', 0)} ${circuit?.tipo_cabo || ''}`.trim() : 'N/D')
}

function makeNode(id, type, label, x, y, data = {}) {
  return {
    id,
    type,
    label,
    position: { x, y },
    data,
    status: data.status || 'NAO_AVALIADO',
  }
}

function makeEdge(id, from, to, data = {}) {
  return { id, from, to, data, status: data.status || 'NAO_AVALIADO' }
}

export function buildUnifilarModel({ projeto = {}, circuitos = [] } = {}) {
  const transformer = parseJsonField(projeto.transformador_dados)
  const protectionRaw = parseJsonField(projeto.protecao_geral_dados)
  const mainProtection = protectionRaw?.geral || protectionRaw?.disjuntor_geral || protectionRaw || {}
  const secondaryVoltage = transformer.tensao_secundaria || projeto.tensao_ref
  const boardNames = [...new Set(circuitos.map(circuitBoard))]
  const boardSpacing = 260
  const circuitSpacing = 150
  const boardStartX = 260
  const nodes = [
    makeNode('entrada', 'entrada', 'Entrada de energia', 620, 70, {
      tag: 'ENT-01',
      descricao: projeto.concessionaria || projeto.contexto || 'Concessionária',
      tensao: fmtEngineeringValue(projeto.tensao_ref, ' V', 0),
      status: 'OK',
    }),
    makeNode('transformador', 'transformador', transformer.potencia_kva ? 'Transformador' : 'Fonte / Transformador', 620, 190, {
      tag: 'TR-01',
      potencia: fmtEngineeringValue(transformer.potencia_kva, ' kVA', 1),
      tensao: `${fmtEngineeringValue(transformer.tensao_primaria, ' V', 0)} / ${fmtEngineeringValue(secondaryVoltage, ' V', 0)}`,
      corrente: fmtEngineeringValue(transformer.corrente_curto_secundario_ka, ' kA', 2),
      status: transformer.potencia_kva || secondaryVoltage ? 'OK' : 'INCOMPLETO',
    }),
    makeNode('qgbt', 'qgbt', 'QGBT', 620, 340, {
      tag: 'QGBT',
      tensao: fmtEngineeringValue(secondaryVoltage, ' V', 0),
      disjuntor: circuitProtection(mainProtection),
      status: normalizeUnifilarStatus(mainProtection.status || (secondaryVoltage ? 'OK' : 'INCOMPLETO')),
    }),
  ]

  const edges = [
    makeEdge('entrada-transformador', 'entrada', 'transformador', {
      cabo: 'Alimentação concessionária',
      tensao: fmtEngineeringValue(projeto.tensao_ref, ' V', 0),
      status: 'OK',
    }),
    makeEdge('transformador-qgbt', 'transformador', 'qgbt', {
      cabo: 'Alimentador principal',
      tensao: fmtEngineeringValue(secondaryVoltage, ' V', 0),
      disjuntor: circuitProtection(mainProtection),
      status: normalizeUnifilarStatus(mainProtection.status || 'OK'),
    }),
  ]

  boardNames.forEach((name, index) => {
    const x = boardStartX + index * boardSpacing
    nodes.push(makeNode(`board-${index}`, name === 'QGBT' ? 'quadro' : 'quadro', name, x, 500, {
      tag: name,
      descricao: name === 'QGBT' ? 'Circuitos ligados ao quadro geral' : 'Quadro derivado',
      tensao: fmtEngineeringValue(secondaryVoltage, ' V', 0),
      status: 'NAO_AVALIADO',
    }))
    edges.push(makeEdge(`qgbt-board-${index}`, 'qgbt', `board-${index}`, {
      cabo: 'Alimentador de quadro',
      tensao: fmtEngineeringValue(secondaryVoltage, ' V', 0),
      status: 'NAO_AVALIADO',
    }))
  })

  circuitos.forEach((circuit, index) => {
    const boardIndex = Math.max(0, boardNames.indexOf(circuitBoard(circuit)))
    const boardX = boardStartX + boardIndex * boardSpacing
    const siblingIndex = circuitos.slice(0, index).filter((item) => circuitBoard(item) === circuitBoard(circuit)).length
    const x = boardX - 70 + (siblingIndex % 2) * circuitSpacing
    const y = 700 + Math.floor(siblingIndex / 2) * 135
    const status = normalizeUnifilarStatus(circuit.status_final || circuit.status)
    const circuitId = circuit._id || circuit.id || `circuit-${index}`
    nodes.push(makeNode(`circuit-${circuitId}`, circuitType(circuit), circuit.tag || `C-${index + 1}`, x, y, {
      linkedCircuitId: circuitId,
      tag: circuit.tag || `C-${index + 1}`,
      descricao: circuit.descricao || 'Circuito sem descrição',
      quadro: circuitBoard(circuit),
      tensao: fmtEngineeringValue(circuit.tensao, ' V', 0),
      corrente: fmtEngineeringValue(circuit.corrente_projeto || circuit.corrente_nominal, ' A', 1),
      potencia: fmtEngineeringValue(circuit.potencia_kw, ' kW', 1),
      cabo: circuitCable(circuit),
      disjuntor: circuitProtection(circuit),
      queda: fmtEngineeringValue(circuit.queda_tensao_percentual || circuit.queda_percentual || circuit.queda, '%', 2),
      pendencias: circuit.validacao_mensagem || circuit.alerta || '',
      status,
    }))
    edges.push(makeEdge(`board-${boardIndex}-circuit-${circuitId}`, `board-${boardIndex}`, `circuit-${circuitId}`, {
      linkedCircuitId: circuitId,
      cabo: circuitCable(circuit),
      disjuntor: circuitProtection(circuit),
      queda: fmtEngineeringValue(circuit.queda_tensao_percentual || circuit.queda_percentual || circuit.queda, '%', 2),
      status,
    }))
  })

  return {
    revision: projeto.revisao || '0',
    updatedAt: new Date().toISOString(),
    nodes,
    edges,
    bounds: {
      width: Math.max(1280, boardStartX + Math.max(1, boardNames.length) * boardSpacing + 280),
      height: Math.max(920, 780 + Math.ceil(Math.max(1, circuitos.length) / Math.max(1, boardNames.length || 1)) * 150),
    },
  }
}

