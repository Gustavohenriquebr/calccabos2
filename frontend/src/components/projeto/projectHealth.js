import { normalizeStatus } from '../ui'

export function parseDados(valor) {
  if (!valor) return {}
  if (typeof valor === 'object') return valor
  let parsed
  try { parsed = JSON.parse(valor) } catch { parsed = {} }
  return parsed && typeof parsed === 'object' ? parsed : {}
}

export function statusFinalCircuito(circuito) {
  if (circuito?.status_final) return normalizeStatus(circuito.status_final)
  if (circuito?.status === 'ok') return 'OK'
  if (circuito?.status === 'erro' || circuito?.status === 'critico') return 'CRITICO'
  if (circuito?.status === 'alerta') return 'ALERTA'
  return 'ALERTA'
}

function statusMaisGrave(statuses) {
  const peso = { OK: 0, ALERTA: 1, CRITICO: 2 }
  return statuses.reduce((atual, status) => {
    const normalizado = normalizeStatus(status, 'ALERTA')
    return peso[normalizado] > peso[atual] ? normalizado : atual
  }, 'OK')
}

function temValor(valor) {
  return valor !== null && valor !== undefined && valor !== ''
}

function statusTransformador(transformador) {
  return transformador.potencia_kva && transformador.tensao_secundaria ? 'OK' : 'ALERTA'
}

function statusSistema(sistema, circuitos) {
  return sistema.potencia_aparente_kva || sistema.corrente_linha || circuitos.length ? 'OK' : 'ALERTA'
}

function statusProtecaoGeral(protecao) {
  if (protecao.status) return normalizeStatus(protecao.status)
  return protecao.in && protecao.icu ? 'OK' : 'ALERTA'
}

function statusParaRaios(paraRaios) {
  return normalizeStatus(paraRaios.status, 'ALERTA')
}

function statusAterramento(aterramento) {
  return normalizeStatus(aterramento.status, 'ALERTA')
}

function statusAreas(areas) {
  if (areas.status) return normalizeStatus(areas.status)
  if (Number(areas?.resumo?.equipamentos_criticos || 0) > 0) return 'CRITICO'
  return areas?.areas?.length ? 'OK' : 'ALERTA'
}

function contarCircuitos(circuitos) {
  const statuses = circuitos.map(statusFinalCircuito)
  return {
    total: circuitos.length,
    ok: statuses.filter((status) => status === 'OK').length,
    alerta: statuses.filter((status) => status === 'ALERTA').length,
    critico: statuses.filter((status) => status === 'CRITICO').length,
    status: statuses.length ? statusMaisGrave(statuses) : 'ALERTA',
  }
}

function temIccManual(projeto, protecaoGeral) {
  const candidatos = [
    projeto?.icc_entrada_ka,
    projeto?.icc_manual_ka,
    protecaoGeral?.icc,
    protecaoGeral?.icc_ka,
    protecaoGeral?.corrente_curto,
    protecaoGeral?.corrente_curto_ka,
  ]
  return candidatos.some((valor) => Number(valor) > 0)
}

export function isCircuitNotEvaluated(circuito) {
  const estados = [
    circuito?.protecao_avaliacao_status,
    circuito?.criterios?.protection?.status,
    circuito?.criterios?.short_circuit?.status,
  ]
  if (estados.some((estado) => String(estado || '').toUpperCase() === 'NOT_EVALUATED')) return true
  const nota = `${circuito?.protecao_nota || ''} ${circuito?.validacao_mensagem || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return nota.includes('nao avaliad') || nota.includes('nao verificad') || nota.includes('nao informado')
}

function contarNaoAvaliados(circuitos) {
  return circuitos.filter(isCircuitNotEvaluated).length
}

function etapa(id, titulo, status, descricao, destino, pendencias = []) {
  return { id, titulo, status, descricao, destino, pendencias }
}

export function buildProjectFlow(projeto, circuitos = []) {
  const transformador = parseDados(projeto?.transformador_dados)
  const protecaoGeral = parseDados(projeto?.protecao_geral_dados)
  const dadosProjetoPendentes = []
  if (!projeto?.nome) dadosProjetoPendentes.push('Informe o nome do projeto')
  if (!projeto?.cliente) dadosProjetoPendentes.push('Informe o cliente')
  if (!projeto?.contexto) dadosProjetoPendentes.push('Defina o contexto do projeto')
  if (!Number(projeto?.tensao_ref)) dadosProjetoPendentes.push('Defina a tensão de referência')

  const dadosProjetoProntos = dadosProjetoPendentes.length === 0
  const trafoPendencias = []
  const fonteManual = temIccManual(projeto, protecaoGeral)
  if (!fonteManual) {
    if (!Number(transformador?.potencia_kva)) trafoPendencias.push('Informe a potência nominal em kVA')
    if (!Number(transformador?.tensao_secundaria)) trafoPendencias.push('Informe a tensão secundária')
    if (!Number(transformador?.impedancia_percentual)) trafoPendencias.push('Informe a impedância Z%')
  }
  const fontePronta = fonteManual || trafoPendencias.length === 0

  const resumoCircuitos = contarCircuitos(circuitos)
  const naoAvaliados = contarNaoAvaliados(circuitos)
  const circuitosCalculados = circuitos.filter((circuito) =>
    Number(circuito?.corrente_projeto) > 0 && Number(circuito?.secao_mm2) > 0
  ).length
  const circuitosPendencias = []
  if (!circuitos.length) circuitosPendencias.push('Adicione pelo menos um circuito')
  else if (!circuitosCalculados) circuitosPendencias.push('Calcule os circuitos cadastrados')

  const revisaoPendencias = []
  if (resumoCircuitos.critico) revisaoPendencias.push(`Resolva ${resumoCircuitos.critico} circuito(s) bloqueado(s)`)
  if (resumoCircuitos.alerta) revisaoPendencias.push(`Revise ${resumoCircuitos.alerta} circuito(s) com alerta`)
  if (naoAvaliados) revisaoPendencias.push(`Analise ${naoAvaliados} circuito(s) com verificação não avaliada`)

  const relatorioFinalLiberado = Boolean(
    dadosProjetoProntos &&
    fontePronta &&
    circuitosCalculados > 0 &&
    resumoCircuitos.critico === 0
  )
  const relatorioPreliminarDisponivel = circuitosCalculados > 0

  const etapas = [
    etapa('dados-projeto', 'Projeto', dadosProjetoProntos ? 'PRONTO' : 'INCOMPLETO', 'Identificação e referências básicas.', 'visao-geral', dadosProjetoPendentes),
    etapa('entrada', 'Entrada / Fonte', fontePronta ? 'PRONTO' : 'INCOMPLETO', fonteManual ? 'Icc declarada manualmente.' : 'Transformador e curto presumido.', 'transformador', trafoPendencias),
    etapa(
      'circuitos',
      'Circuitos',
      resumoCircuitos.critico ? 'BLOQUEADO' : circuitosCalculados ? (resumoCircuitos.alerta || naoAvaliados ? 'COM_ALERTAS' : 'PRONTO') : circuitos.length ? 'INCOMPLETO' : 'NAO_INICIADO',
      'Cadastro, cálculo e proteção.',
      'circuitos',
      circuitosPendencias,
    ),
    etapa(
      'revisao',
      'Proteções / Revisão',
      resumoCircuitos.critico ? 'BLOQUEADO' : circuitosCalculados ? (revisaoPendencias.length ? 'COM_ALERTAS' : 'PRONTO') : 'NAO_INICIADO',
      'Pendências e verificações.',
      'revisao-tecnica',
      revisaoPendencias,
    ),
    etapa(
      'memorial',
      'Memorial / Relatório',
      relatorioFinalLiberado ? (naoAvaliados ? 'COM_ALERTAS' : 'PRONTO') : circuitosCalculados ? 'BLOQUEADO' : 'NAO_INICIADO',
      relatorioFinalLiberado ? 'Emissão final disponível.' : 'Aguardando dados mínimos.',
      'memorial',
      relatorioFinalLiberado ? [] : ['Resolva as etapas anteriores para liberar a emissão final'],
    ),
  ]

  let proximaAcao = { label: 'Gerar memorial', destino: 'memorial' }
  if (!dadosProjetoProntos) proximaAcao = { label: 'Preencher dados do projeto', destino: 'visao-geral' }
  else if (!fontePronta) proximaAcao = { label: 'Configurar entrada', destino: 'transformador' }
  else if (!circuitos.length) proximaAcao = { label: 'Adicionar circuitos', destino: 'circuitos', action: 'new-circuit' }
  else if (!circuitosCalculados) proximaAcao = { label: 'Calcular circuitos', destino: 'circuitos', action: 'calculate' }
  else if (resumoCircuitos.critico || resumoCircuitos.alerta || naoAvaliados) proximaAcao = { label: 'Revisar pendências', destino: 'revisao-tecnica' }

  return {
    etapas,
    proximaAcao,
    dadosProjetoProntos,
    fontePronta,
    fonteManual,
    circuitosCalculados,
    naoAvaliados,
    relatorioFinalLiberado,
    relatorioPreliminarDisponivel,
    resumoCircuitos,
  }
}

function criarPendencia(tipo, titulo, descricao, status) {
  return { tipo, titulo, descricao, status }
}

function calcularCompletude(projeto, circuitos, modulos) {
  const itens = [
    Boolean(projeto?.nome),
    Boolean(projeto?.cliente),
    Boolean(modulos.transformador.potencia_kva && modulos.transformador.tensao_secundaria),
    Boolean(modulos.sistema.potencia_aparente_kva || modulos.sistema.corrente_linha || circuitos.length),
    Boolean(circuitos.length),
    Boolean(modulos.protecaoGeral.in && modulos.protecaoGeral.icu),
    normalizeStatus(modulos.paraRaios.status, 'ALERTA') === 'OK',
    Boolean((modulos.aterramento.medicoes || []).length || modulos.aterramento.resistividade_media),
    Boolean((modulos.areas.areas || []).length),
    Boolean(circuitos.length),
  ]
  const completos = itens.filter(Boolean).length
  return Math.round((completos / itens.length) * 100)
}

function prontidaoProjeto(statusGeral, completude, circuitos) {
  if (!circuitos.length || completude < 35) {
    return { label: 'Rascunho', status: 'ALERTA' }
  }
  if (statusGeral === 'CRITICO') {
    return { label: 'Não liberado para emissão', status: 'CRITICO' }
  }
  if (statusGeral === 'ALERTA') {
    return { label: 'Em revisão', status: 'ALERTA' }
  }
  return { label: 'Pronto para emissão', status: 'OK' }
}

function pendenciasCircuitos(circuitos) {
  return circuitos
    .filter((circuito) => statusFinalCircuito(circuito) !== 'OK')
    .slice(0, 8)
    .map((circuito) => {
      const status = statusFinalCircuito(circuito)
      const nome = circuito.tag || circuito.descricao || `Circuito ${circuito.id || ''}`.trim()
      const descricao = circuito.validacao_mensagem || circuito.protecao_nota || circuito.selecao_componentes_justificativa || 'Requer revisão técnica.'
      return criarPendencia(status === 'CRITICO' ? 'criticas' : 'alertas', nome, descricao, status)
    })
}

export function buildProjectHealth(projeto, circuitos = [], usuario = {}) {
  const transformador = parseDados(projeto?.transformador_dados)
  const sistema = parseDados(projeto?.sistema_trifasico_dados)
  const protecaoGeral = parseDados(projeto?.protecao_geral_dados)
  const paraRaios = parseDados(projeto?.para_raios_dados)
  const aterramento = parseDados(projeto?.aterramento_dados)
  const areas = parseDados(projeto?.areas_classificadas_dados)

  const circuitosResumo = contarCircuitos(circuitos)
  const modulos = {
    transformador,
    sistema,
    protecaoGeral,
    paraRaios,
    aterramento,
    areas,
  }
  const statusModulos = {
    transformador: statusTransformador(transformador),
    sistema: statusSistema(sistema, circuitos),
    protecaoGeral: statusProtecaoGeral(protecaoGeral),
    paraRaios: statusParaRaios(paraRaios),
    aterramento: statusAterramento(aterramento),
    areas: statusAreas(areas),
  }
  const modulosResumo = {
    ok: Object.values(statusModulos).filter((status) => status === 'OK').length,
    alerta: Object.values(statusModulos).filter((status) => status === 'ALERTA').length,
    critico: Object.values(statusModulos).filter((status) => status === 'CRITICO').length,
  }

  const fluxo = buildProjectFlow(projeto, circuitos)
  // Módulos complementares permanecem visíveis sem rebaixar o fluxo principal.
  const statusGeral = circuitosResumo.critico ? 'CRITICO' : fluxo.relatorioFinalLiberado && !fluxo.naoAvaliados ? 'OK' : 'ALERTA'
  const maiorQt = Math.max(0, ...circuitos.map((c) => Number(c.queda_tensao_acumulada ?? c.queda_tensao_pct ?? 0)).filter(Number.isFinite))
  const maiorIcc = Math.max(0, ...circuitos.map((c) => Number(c.isc_local || 0)).filter(Number.isFinite))
  const completude = calcularCompletude(projeto, circuitos, modulos)
  const prontidao = prontidaoProjeto(statusGeral, completude, circuitos)

  const pendencias = {
    criticas: [],
    alertas: [],
    faltantes: [],
  }

  pendenciasCircuitos(circuitos).forEach((item) => {
    pendencias[item.tipo].push(item)
  })

  if (!circuitos.length) {
    pendencias.faltantes.push(criarPendencia('faltantes', 'Circuitos não cadastrados', 'Importe uma planilha ou crie circuitos manualmente.', 'ALERTA'))
  }
  if (!transformador.potencia_kva || !transformador.tensao_secundaria) {
    pendencias.faltantes.push(criarPendencia('faltantes', 'Transformador incompleto', 'Cadastre potência e tensão secundária para consolidar a entrada.', 'ALERTA'))
  }
  if (!protecaoGeral.in || !protecaoGeral.icu) {
    pendencias.faltantes.push(criarPendencia('faltantes', 'Proteção geral incompleta', 'Informe In e Icu do disjuntor geral quando aplicável.', 'ALERTA'))
  }
  if (statusModulos.paraRaios === 'ALERTA') {
    pendencias.alertas.push(criarPendencia('alertas', 'Para-raios incompleto', paraRaios.mensagem || 'Para-raios não informado ou incompleto.', 'ALERTA'))
  } else if (statusModulos.paraRaios === 'CRITICO') {
    pendencias.criticas.push(criarPendencia('criticas', 'Para-raios crítico', paraRaios.mensagem || 'Dados do para-raios requerem correção.', 'CRITICO'))
  }
  if (statusModulos.aterramento === 'ALERTA') {
    pendencias.alertas.push(criarPendencia('alertas', 'Aterramento em alerta', aterramento.mensagem || 'Dados de aterramento incompletos ou insuficientes.', 'ALERTA'))
  } else if (statusModulos.aterramento === 'CRITICO') {
    pendencias.criticas.push(criarPendencia('criticas', 'Aterramento crítico', aterramento.mensagem || 'Aterramento requer correção.', 'CRITICO'))
  }
  if (statusModulos.areas === 'CRITICO') {
    pendencias.criticas.push(criarPendencia('criticas', 'Área classificada crítica', areas.mensagem || 'Há equipamento incompatível ou sem proteção Ex.', 'CRITICO'))
  } else if (statusModulos.areas === 'ALERTA') {
    pendencias.alertas.push(criarPendencia('alertas', 'Áreas classificadas incompletas', areas.mensagem || 'Áreas classificadas não informadas.', 'ALERTA'))
  }
  if (!temValor(usuario?.crea)) {
    pendencias.faltantes.push(criarPendencia('faltantes', 'CREA não informado', 'Complete o cadastro do responsável técnico para emissão documental.', 'ALERTA'))
  }

  return {
    circuitos: circuitosResumo,
    modulos: modulosResumo,
    statusModulos,
    statusGeral,
    prontidao,
    completude,
    maiorQt: maiorQt || null,
    maiorIcc: maiorIcc || null,
    pendencias,
    fluxo,
  }
}
