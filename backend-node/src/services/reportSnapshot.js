'use strict'

const crypto = require('crypto')

const ENGINE_VERSION = 'calcabos-engine-snapshot-v1'

const FORBIDDEN_KEYS = new Set([
  'senha',
  'senhaHash',
  'password',
  'hash',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'jwt',
  'authorization',
  'cookie',
  'usuarioId',
  'ownerId',
  'userId',
])

function cleanText(value, max = 500) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/([A-Za-z]:\\|\/Users\/|\/home\/|\/var\/|\/tmp\/)[^\s]+/g, '[path-removido]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function statusFinal(value) {
  const text = String(value || '').trim().toUpperCase()
  if (text === 'OK') return 'OK'
  if (text.includes('CR') || text.includes('BLOQUEADO') || text === 'ERRO') return 'BLOQUEADO'
  if (text.includes('ALERTA') || text.includes('WARNING')) return 'ALERTA'
  if (text.includes('PENDENTE') || text.includes('INCOMPLETO')) return 'INCOMPLETO'
  return 'NAO_AVALIADO'
}

function safeObject(value, depth = 0) {
  if (depth > 4) return '[limite]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return cleanText(value, 1000)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => safeObject(item, depth + 1))
  if (typeof value === 'object') {
    const out = {}
    Object.entries(value).forEach(([key, item]) => {
      if (FORBIDDEN_KEYS.has(key) || /secret|token|senha|password|hash|key/i.test(key)) return
      out[key] = safeObject(item, depth + 1)
    })
    return out
  }
  return cleanText(value)
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function hashInput(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex')
}

function circuitSnapshot(circuito, index) {
  const queda = numberOrNull(circuito.queda_tensao_acumulada ?? circuito.queda_tensao_pct ?? circuito.queda)
  const status = statusFinal(circuito.status_final || circuito.status || circuito.validacao_status)
  const tensaoMeta = circuito.metadados_calculo?.tensao || {}
  const alertas = []
  if (circuito.validacao_mensagem) alertas.push(cleanText(circuito.validacao_mensagem))
  if (circuito.protecao_nota) alertas.push(cleanText(circuito.protecao_nota))
  if (circuito.selecao_componentes_justificativa) alertas.push(cleanText(circuito.selecao_componentes_justificativa))
  if (Array.isArray(tensaoMeta.alertas)) {
    tensaoMeta.alertas.forEach((item) => {
      if (item?.message) alertas.push(cleanText(item.message))
    })
  }
  if (status !== 'OK' && alertas.length === 0) alertas.push(`Circuito ${status.toLowerCase()} requer revisão técnica.`)

  return {
    id: cleanText(circuito._id || circuito.id || `circuito-${index + 1}`, 120),
    tag: cleanText(circuito.tag || `C-${index + 1}`, 80),
    descricao: cleanText(circuito.descricao || 'Circuito sem descrição', 200),
    origem: cleanText(circuito.from_barramento || circuito.quadro || ''),
    destino: cleanText(circuito.to_equipamento || ''),
    dados_informados: {
      potencia_kw: numberOrNull(circuito.potencia_kw),
      potencia_kva: numberOrNull(circuito.potencia_kva),
      tensao: numberOrNull(circuito.tensao),
      tensao_unidade: cleanText(circuito.tensao_unidade || tensaoMeta.unidade || 'V', 20),
      tensao_v: numberOrNull(tensaoMeta.tensao_v),
      tensao_kv: numberOrNull(tensaoMeta.tensao_kv),
      tipo_sistema_tensao: cleanText(circuito.tipo_sistema_tensao || circuito.corrente_ac_dc || tensaoMeta.tipo_sistema || 'AC', 20),
      referencia_tensao: cleanText(circuito.referencia_tensao || circuito.referencia_tensao_dc || tensaoMeta.referencia || ''),
      classificacao_tensao: cleanText(tensaoMeta.classificacao || ''),
      contexto_aplicacao: cleanText(circuito.contexto_aplicacao || tensaoMeta.contexto_aplicacao || ''),
      fases: numberOrNull(circuito.fases),
      fator_potencia: numberOrNull(circuito.fator_potencia),
      distancia_m: numberOrNull(circuito.distancia_m),
      metodo_instalacao: cleanText(circuito.metodo_instalacao || ''),
      tipo_cabo: cleanText(circuito.tipo_cabo || ''),
      agrupamento: numberOrNull(circuito.agrupamento),
      temperatura_ambiente: numberOrNull(circuito.temp_ambiente),
    },
    resultados: {
      corrente_projeto_a: numberOrNull(circuito.corrente_projeto ?? circuito.corrente_nominal),
      corrente_corrigida_a: numberOrNull(circuito.corrente_corrigida),
      ampacidade_a: numberOrNull(circuito.ampacidade_corrigida_total ?? circuito.ampacidade),
      secao_mm2: numberOrNull(circuito.secao_mm2 ?? circuito.cabo_sugerido_secao),
      cabo: cleanText(circuito.cabo_sugerido_tipo_comercial || circuito.tipo_cabo_comercial || circuito.tipo_cabo || ''),
      queda_tensao_pct: queda,
      queda_tensao_max_pct: numberOrNull(circuito.queda_tensao_max ?? circuito.queda_tensao_limite),
      disjuntor_a: numberOrNull(circuito.disjuntor_sugerido_in ?? circuito.disjuntor_corrente_nominal ?? circuito.disjuntor_a),
      icu_ka: numberOrNull(circuito.disjuntor_sugerido_icu ?? circuito.disjuntor_icu),
      curva: cleanText(circuito.disjuntor_sugerido_curva || circuito.disjuntor_curva || ''),
      isc_local_ka: numberOrNull(circuito.isc_local),
      isc_cabo_ka: numberOrNull(circuito.isc_cabo),
    },
    criterios: safeObject(circuito.criterios || {
      ampacidade: 'Corrente corrigida menor ou igual à capacidade do condutor selecionado.',
      queda_tensao: 'Queda calculada menor ou igual ao limite adotado.',
      secao_minima: 'Seção selecionada respeita mínimos declarados/aplicáveis.',
      protecao: 'Dispositivo compatível com corrente, capacidade de interrupção e dados informados.',
      curto_circuito: circuito.isc_local ? 'Verificação considerada quando corrente de curto foi informada.' : 'Verificação não avaliada por ausência de dados de curto-circuito.',
    }),
    decisao: safeObject(circuito.decisao || {
      status,
      mensagem: status === 'OK' ? 'Critérios calculados sem bloqueio registrado.' : 'Requer revisão antes de emissão final.',
    }),
    memorial: safeObject(circuito.memorial || {
      resumo: 'Resultado documentado a partir do snapshot salvo do circuito.',
      steps: [
        'Leitura dos dados informados.',
        'Consulta dos resultados persistidos do motor.',
        'Comparação com critérios e limites registrados.',
      ],
    }),
    premissas: safeObject(circuito.premissas || []),
    alertas,
    limitacoes: safeObject([...(circuito.limitacoes || []), ...(tensaoMeta.limitacoes || [])]),
    status,
  }
}

function projectSnapshot(projeto) {
  return {
    id: cleanText(projeto._id || projeto.id || '', 120),
    nome: cleanText(projeto.nome || 'Projeto sem nome', 200),
    cliente: cleanText(projeto.cliente || ''),
    uf: cleanText(projeto.uf || ''),
    cidade: cleanText(projeto.cidade || ''),
    concessionaria: cleanText(projeto.concessionaria || ''),
    contexto: cleanText(projeto.contexto || ''),
    tensao_referencia_v: numberOrNull(projeto.tensao_ref),
    revisao: cleanText(projeto.revisao || projeto.revision || '0', 60),
    responsavel_tecnico: cleanText(projeto.responsavelTecnico || projeto.responsavel_tecnico || ''),
    observacoes_locais: cleanText(projeto.observacoes_locais || projeto.descricao || '', 1200),
    norma_referencia: cleanText(projeto.normaVersao || 'NBR 5410:2004', 120),
  }
}

function buildReportSnapshot({ projeto, circuitos = [], usuario = {}, requestedMode = 'final' }) {
  const generatedAt = new Date().toISOString()
  const project = projectSnapshot(projeto || {})
  const circuits = circuitos.map(circuitSnapshot)
  const counts = circuits.reduce((acc, circuit) => {
    acc[circuit.status] = (acc[circuit.status] || 0) + 1
    return acc
  }, {})
  const missingProjectFields = [
    ['cliente', project.cliente],
    ['tensao de referência', project.tensao_referencia_v],
  ].filter(([, value]) => value === null || value === undefined || value === '').map(([label]) => label)
  const blocking = [
    ...circuits.filter((circuit) => circuit.status === 'BLOQUEADO').map((circuit) => `${circuit.tag}: ${circuit.alertas[0] || 'bloqueio técnico'}`),
    ...missingProjectFields.map((field) => `Dado obrigatório ausente: ${field}`),
  ]
  const warnings = circuits
    .filter((circuit) => circuit.status === 'ALERTA' || circuit.status === 'INCOMPLETO' || circuit.status === 'NAO_AVALIADO')
    .map((circuit) => `${circuit.tag}: ${circuit.alertas[0] || `status ${circuit.status}`}`)

  const finalReleased = blocking.length === 0 && circuits.length > 0
  const documentStatus = requestedMode === 'preliminar' || !finalReleased ? 'PRELIMINAR' : 'FINAL'
  const base = {
    schema_version: 'report-snapshot-v1',
    engine_version: ENGINE_VERSION,
    generated_at: generatedAt,
    document_status: documentStatus,
    final_released: finalReleased,
    project,
    usuario: {
      nome: cleanText(usuario.nome || ''),
      email: cleanText(usuario.email || ''),
      crea: cleanText(usuario.crea || ''),
      empresa: cleanText(usuario.empresa || ''),
    },
    summary: {
      total_circuitos: circuits.length,
      ok: counts.OK || 0,
      alertas: counts.ALERTA || 0,
      bloqueados: counts.BLOQUEADO || 0,
      incompletos: counts.INCOMPLETO || 0,
      nao_avaliados: counts.NAO_AVALIADO || 0,
      bloqueios: blocking,
      avisos: warnings,
    },
    premissas: [
      'Relatório gerado como apoio técnico a partir dos resultados persistidos do CalcCabos.',
      'Critérios, entradas, decisões e memoriais são registrados no snapshot para rastreabilidade.',
      'Verificações sem dados suficientes são marcadas como não avaliadas ou preliminares.',
    ],
    limitacoes: [
      'Este documento não substitui validação de engenheiro eletricista habilitado.',
      'Não declara aprovação final automática nem conformidade normativa sem revisão profissional.',
      'Resultados dependem da qualidade e completude dos dados informados.',
    ],
    circuits,
  }
  const inputForHash = {
    project: base.project,
    circuits: base.circuits,
    premissas: base.premissas,
    limitacoes: base.limitacoes,
    engine_version: base.engine_version,
  }
  return {
    ...base,
    input_hash: hashInput(inputForHash),
  }
}

module.exports = {
  ENGINE_VERSION,
  buildReportSnapshot,
  cleanText,
  hashInput,
  statusFinal,
}
