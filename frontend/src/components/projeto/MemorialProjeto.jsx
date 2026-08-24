import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import { Alert, Card, CardBody, StatusBadge } from '../ui'

function parseDados(valor) {
  if (!valor) return {}
  if (typeof valor === 'object') return valor
  try {
    return JSON.parse(valor)
  } catch {
    return {}
  }
}

const REPAROS_TEXTO = [
  ['Consist?ncia', 'Consistência'],
  ['consist?ncia', 'consistência'],
  ['subesta??o', 'subestação'],
  ['Subesta??o', 'Subestação'],
  ['Medi??es', 'Medições'],
  ['medi??es', 'medições'],
  ['N?OAPLIC?VEL', 'NÃO APLICÁVEL'],
  ['N?O APLIC?VEL', 'NÃO APLICÁVEL'],
  ['n?o aplic?vel', 'não aplicável'],
  ['Respons?vel', 'Responsável'],
  ['respons?vel', 'responsável'],
  ['Eng. Respons?vel', 'Eng. Responsável'],
  ['Engenheiro respons?vel', 'Engenheiro responsável'],
  ['Descri??o', 'Descrição'],
  ['descri??o', 'descrição'],
  ['Observa??es', 'Observações'],
  ['observa??es', 'observações'],
  ['t?cnico', 'técnico'],
  ['T?cnico', 'Técnico'],
  ['el?trico', 'elétrico'],
  ['El?trico', 'Elétrico'],
  ['pot?ncia', 'potência'],
  ['Pot?ncia', 'Potência'],
  ['tens?o', 'tensão'],
  ['Tens?o', 'Tensão'],
  ['prote??o', 'proteção'],
  ['Prote??o', 'Proteção'],
  ['cr?tico', 'crítico'],
  ['Cr?tico', 'Crítico'],
  ['pend?ncia', 'pendência'],
  ['Pend?ncia', 'Pendência'],
]

function limparTexto(valor, padrao = 'não informado') {
  if (valor === null || valor === undefined || valor === '') return padrao
  let texto = String(valor)
  REPAROS_TEXTO.forEach(([origem, destino]) => {
    texto = texto.replaceAll(origem, destino)
  })
  return texto.replace(/([A-Za-zÀ-ÿ0-9])\?+([A-Za-zÀ-ÿ0-9])/g, '$1$2')
}

function protecaoGeralDados(dados) {
  const bruto = dados?.geral && typeof dados.geral === 'object'
    ? dados.geral
    : dados?.disjuntor_geral && typeof dados.disjuntor_geral === 'object'
      ? dados.disjuntor_geral
      : dados || {}

  return {
    ...bruto,
    tag: bruto.tag || bruto.identificacao || bruto.nome,
    tipo: bruto.tipo || bruto.protection_device || bruto.dispositivo,
    vn: bruto.vn ?? bruto.Vn ?? bruto.tensao_nominal ?? bruto.tensao_nominal_v ?? bruto.disjuntor_tensao_nominal,
    in: bruto.in ?? bruto.In ?? bruto.corrente_nominal ?? bruto.corrente_nominal_a ?? bruto.disjuntor_corrente_nominal,
    icu: bruto.icu ?? bruto.Icu ?? bruto.icu_ka ?? bruto.capacidade_interrupcao ?? bruto.capacidade_interrupcao_ka ?? bruto.disjuntor_icu,
    curva: bruto.curva || bruto.curve,
  }
}

function aterramentoDados(dados) {
  return {
    ...dados,
    tipo_aterramento: dados?.tipo_aterramento || dados?.tipo || dados?.tipoAterramento || '',
  }
}

function calcularSistemaCircuitos(circuitos, sistema = {}, tensaoRef = 380) {
  const validos = (circuitos || []).filter((c) => Number(c.potencia_kw) > 0)
  if (!validos.length) return sistema || {}
  const totais = validos.reduce((acc, c) => {
    const kw = Number(c.potencia_kw || 0)
    const fp = Number(c.fator_potencia || 1) > 1 ? Number(c.fator_potencia || 1) / 100 : Number(c.fator_potencia || 1)
    const eta = Number(c.fator_eficiencia || 1) > 1 ? Number(c.fator_eficiencia || 1) / 100 : Number(c.fator_eficiencia || 1)
    const rendimento = eta > 0 ? eta : 1
    const fatorPotencia = fp > 0 ? fp : 1
    const pEletrica = kw / rendimento
    const s = kw / (fatorPotencia * rendimento)
    const q = Math.sqrt(Math.max((s * s) - (pEletrica * pEletrica), 0))
    return {
      nominal: acc.nominal + kw,
      eletrica: acc.eletrica + pEletrica,
      aparente: acc.aparente + s,
      reativa: acc.reativa + q,
    }
  }, { nominal: 0, eletrica: 0, aparente: 0, reativa: 0 })
  const tensao = Number(validos.find((c) => Number(c.tensao) > 0)?.tensao || tensaoRef || sistema?.tensao_linha || 380)
  const corrente = tensao > 0 ? (totais.aparente * 1000) / (Math.sqrt(3) * tensao) : null
  return {
    ...sistema,
    potencia_nominal_cargas_kw: totais.nominal,
    potencia_ativa_eletrica_kw: totais.eletrica,
    potencia_ativa_kw: totais.eletrica,
    potencia_aparente_kva: totais.aparente,
    potencia_reativa_kvar: totais.reativa,
    fator_potencia: totais.aparente > 0 ? totais.eletrica / totais.aparente : null,
    tensao_linha: tensao,
    corrente_linha: corrente,
  }
}

function fmt(valor, sufixo = '', casas = 2) {
  if (valor === null || valor === undefined || valor === '') return 'não informado'
  const numero = Number(valor)
  if (Number.isNaN(numero)) return valor
  return `${Number.isInteger(numero) ? numero : numero.toFixed(casas)}${sufixo}`
}

function normalizarStatus(status, padrao = 'ALERTA') {
  if (status === null || status === undefined || status === '') return padrao
  const texto = String(status)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
  if (texto === 'OK') return 'OK'
  if (texto.includes('ALERTA') || texto.includes('WARNING')) return 'ALERTA'
  if (texto.includes('CR') || texto.includes('ERRO') || texto.includes('ERROR')) return 'CRITICO'
  if (texto.includes('NAO') || texto.includes('N/D')) return 'ALERTA'
  return padrao
}

function statusVisual(status) {
  const statusNorm = normalizarStatus(status)
  if (statusNorm === 'CRITICO') return 'CRÍTICO'
  return statusNorm
}

function statusMaisGrave(statuses) {
  const ordem = { OK: 0, ALERTA: 1, CRITICO: 2 }
  return statuses.reduce((atual, status) => {
    const normalizado = normalizarStatus(status, 'ALERTA')
    return ordem[normalizado] > ordem[atual] ? normalizado : atual
  }, 'OK')
}

function statusFinal(c) {
  if (c.status_final) return normalizarStatus(c.status_final)
  if (c.status === 'ok') return 'OK'
  if (c.status === 'erro') return 'CRITICO'
  if (c.status === 'alerta') return 'ALERTA'
  return 'ALERTA'
}

function statusClasse(status) {
  const statusNorm = normalizarStatus(status)
  if (statusNorm === 'CRITICO') return 'bg-danger-50 text-danger-700 border-danger-100'
  if (statusNorm === 'OK') return 'bg-success-50 text-success-700 border-success-100'
  if (statusNorm === 'ALERTA') return 'bg-warning-50 text-warning-700 border-warning-100'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

function Badge({ status }) {
  return <StatusBadge status={normalizarStatus(status, 'ALERTA')} />
}

function Linha({ label, valor }) {
  const texto = limparTexto(valor)
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:grid-cols-[190px_1fr] sm:gap-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800">{texto}</div>
    </div>
  )
}

function Secao({ numero, titulo, status = 'OK', children }) {
  const mostrarStatus = normalizarStatus(status) !== 'OK'
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700">{numero}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        </div>
        {mostrarStatus && <Badge status={status} />}
      </div>
      <CardBody className="text-sm">{children}</CardBody>
    </Card>
  )
}

function resumoStatus(circuitos) {
  const total = circuitos.length
  const ok = circuitos.filter((c) => statusFinal(c) === 'OK').length
  const alertas = circuitos.filter((c) => statusFinal(c) === 'ALERTA').length
  const criticos = circuitos.filter((c) => statusFinal(c) === 'CRITICO').length
  const status = criticos ? 'CRITICO' : alertas || !total ? 'ALERTA' : 'OK'
  return { total, ok, alertas, criticos, status }
}

function contarProtecoes(circuitos) {
  const statuses = circuitos.map((c) => normalizarStatus(c.protecao_status, 'OK'))
  return {
    ok: statuses.filter((status) => status === 'OK').length,
    alerta: statuses.filter((status) => status === 'ALERTA').length,
    critico: statuses.filter((status) => status === 'CRITICO').length,
  }
}

function statusAreasClassificadas(areasClassificadas) {
  if (areasClassificadas?.status) return normalizarStatus(areasClassificadas.status)
  if (Number(areasClassificadas?.resumo?.equipamentos_criticos || 0) > 0) return 'CRITICO'
  if (!areasClassificadas?.areas?.length) return 'ALERTA'
  const statuses = areasClassificadas.areas.flatMap((area) => [
    area.status,
    ...(area.equipamentos || []).map((equipamento) => equipamento.status),
  ])
  return statusMaisGrave(statuses.length ? statuses : ['ALERTA'])
}

function statusParaRaios(paraRaios) {
  return normalizarStatus(paraRaios?.status, 'ALERTA')
}

function statusAterramento(aterramento) {
  return normalizarStatus(aterramento?.status, 'ALERTA')
}

function statusProtecaoGeral(protecaoGeral) {
  if (protecaoGeral?.status) return normalizarStatus(protecaoGeral.status)
  return protecaoGeral?.in && protecaoGeral?.icu ? 'OK' : 'ALERTA'
}

function contarStatus(statuses) {
  const normalizados = statuses.map((status) => normalizarStatus(status, 'ALERTA'))
  return {
    ok: normalizados.filter((status) => status === 'OK').length,
    alerta: normalizados.filter((status) => status === 'ALERTA').length,
    critico: normalizados.filter((status) => status === 'CRITICO').length,
  }
}

function motivoStatusGlobal(resumo, modulos) {
  const criticos = []
  const alertas = []

  if (resumo.criticos) criticos.push(`${resumo.criticos} circuito(s) crítico(s)`)
  if (resumo.protecoes.critico) criticos.push(`${resumo.protecoes.critico} proteção(ões) de circuito crítica(s)`)
  if (modulos.areas === 'CRITICO') criticos.push('Áreas Classificadas')
  if (modulos.protecaoGeral === 'CRITICO') criticos.push('Proteção geral')
  if (modulos.paraRaios === 'CRITICO') criticos.push('Para-raios')
  if (modulos.aterramento === 'CRITICO') criticos.push('Aterramento')

  if (resumo.alertas) alertas.push(`${resumo.alertas} circuito(s) em alerta`)
  if (resumo.protecoes.alerta) alertas.push(`${resumo.protecoes.alerta} proteção(ões) de circuito em alerta`)
  if (modulos.paraRaios === 'ALERTA') alertas.push('Para-raios incompleto ou não informado')
  if (modulos.aterramento === 'ALERTA') alertas.push('Aterramento incompleto ou com pendência')
  if (modulos.areas === 'ALERTA') alertas.push('Áreas Classificadas incompletas')
  if (modulos.protecaoGeral === 'ALERTA') alertas.push('Proteção geral incompleta')

  if (criticos.length) {
    return `Há ${criticos.length} pendência(s) crítica(s): ${criticos.join('; ')}${alertas.length ? `; e ${alertas.length} pendência(s) em alerta.` : '.'}`
  }
  if (alertas.length) return `Há ${alertas.length} pendência(s) em alerta: ${alertas.join('; ')}.`
  return 'Todos os módulos avaliados estão OK.'
}

function resumoGlobalProjeto(circuitos, protecaoGeral, paraRaios, aterramento, areasClassificadas) {
  const resumoCircuitos = resumoStatus(circuitos)
  const protecoes = contarProtecoes(circuitos)
  const modulos = {
    protecaoGeral: statusProtecaoGeral(protecaoGeral),
    paraRaios: statusParaRaios(paraRaios),
    aterramento: statusAterramento(aterramento),
    areas: statusAreasClassificadas(areasClassificadas),
  }
  const statusModulos = [
    resumoCircuitos.status,
    ...circuitos.map((c) => normalizarStatus(c.protecao_status, 'OK')),
    modulos.protecaoGeral,
    modulos.paraRaios,
    modulos.aterramento,
    modulos.areas,
  ]
  const modulosContagem = contarStatus(Object.values(modulos))
  const base = {
    ...resumoCircuitos,
    protecoes,
    modulos_contagem: modulosContagem,
    status: statusMaisGrave(statusModulos),
    status_protecao_geral: modulos.protecaoGeral,
    status_para_raios: modulos.paraRaios,
    status_aterramento: modulos.aterramento,
    status_areas: modulos.areas,
  }
  return {
    ...base,
    motivo_status: motivoStatusGlobal(base, modulos),
  }
}

function conclusoes(circuitos, resumo, paraRaios, aterramento, areasClassificadas) {
  if (!circuitos.length && resumo.status === 'OK') return ['Nenhum circuito cadastrado para emissão do memorial técnico.']
  const linhas = []
  const foraQt = circuitos.filter((c) => Number(c.queda_tensao_acumulada ?? c.queda_tensao_pct ?? 0) > Number(c.queda_tensao_max ?? 999)).length
  const protecaoCritica = resumo.protecoes.critico
  const selecaoCritica = circuitos.filter((c) => normalizarStatus(c.selecao_componentes_status, 'OK') === 'CRITICO').length
  const validacaoCritica = circuitos.filter((c) => normalizarStatus(c.validacao_status, 'OK') === 'CRITICO').length
  const alertas = circuitos.filter((c) => statusFinal(c) === 'ALERTA').length
  const modulosCriticos = []
  const modulosAlerta = []

  if (resumo.status_areas === 'CRITICO') modulosCriticos.push(`Áreas Classificadas: ${areasClassificadas?.mensagem || 'há equipamento crítico'}`)
  if (resumo.status_protecao_geral === 'CRITICO') modulosCriticos.push('Proteção geral crítica')
  if (resumo.status_para_raios === 'CRITICO') modulosCriticos.push(`Para-raios: ${paraRaios?.mensagem || 'dados críticos'}`)
  if (resumo.status_aterramento === 'CRITICO') modulosCriticos.push(`Aterramento: ${aterramento?.mensagem || 'dados críticos'}`)
  if (resumo.status_para_raios === 'ALERTA') modulosAlerta.push('Para-raios não informado ou incompleto.')
  if (resumo.status_aterramento === 'ALERTA') modulosAlerta.push(`Aterramento: ${aterramento?.mensagem || 'dados incompletos'}`)
  if (resumo.protecoes.alerta) modulosAlerta.push(`${resumo.protecoes.alerta} proteção(ões) de circuito em ALERTA`)

  if (resumo.status === 'CRITICO') {
    linhas.push('Projeto NÃO está liberado para emissão final pelo CalcCabos.')
    if (modulosCriticos.length) linhas.push(`Módulos críticos: ${modulosCriticos.join('; ')}`)
  } else if (resumo.status === 'ALERTA') {
    linhas.push('Projeto requer revisão técnica antes da emissão final.')
  } else {
    linhas.push('Projeto atende aos critérios de dimensionamento calculados pelo CalcCabos.')
  }
  if (foraQt) linhas.push(`${foraQt} circuito(s) estão fora do limite de queda de tensão.`)
  if (protecaoCritica) linhas.push(`${protecaoCritica} circuito(s) têm disjuntor/proteção inadequado.`)
  if (selecaoCritica) linhas.push(`${selecaoCritica} circuito(s) não possuem componente automático compatível na série cadastrada.`)
  if (validacaoCritica) linhas.push(`${validacaoCritica} circuito(s) possuem validação normativa crítica.`)
  if (alertas || modulosAlerta.length) {
    const pendencias = []
    if (alertas) pendencias.push(`${alertas} circuito(s) exigem atenção por margem baixa ou dados incompletos`)
    pendencias.push(...modulosAlerta)
    linhas.push(`Pendências em alerta: ${pendencias.join('; ')}`)
  }
  return linhas
}

function TabelaCircuitos({ circuitos }) {
  return (
    <div className="overflow-auto rounded-md border border-gray-100">
      <table className="w-full min-w-[980px] text-xs">
        <thead className="bg-primary-900 text-white">
          <tr>
            {['TAG', 'Descrição', 'Ib', "Ib'", 'Cabo', 'Disjuntor', 'ΔV', 'Status', 'Motivo'].map((h) => (
              <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {circuitos.map((c) => (
            <tr key={c.id} className={`border-b border-gray-100 ${statusFinal(c) === 'CRITICO' ? 'bg-danger-50' : 'bg-white'}`}>
              <td className="px-2 py-2 font-medium">{limparTexto(c.tag, '-')}</td>
              <td className="px-2 py-2">{limparTexto(c.descricao, '-')}</td>
              <td className="px-2 py-2 font-mono">{fmt(c.corrente_projeto || c.corrente_nominal, ' A', 1)}</td>
              <td className="px-2 py-2 font-mono">{fmt(c.corrente_corrigida, ' A', 1)}</td>
              <td className="px-2 py-2 font-mono">{c.cabo_sugerido_tipo_comercial || c.tipo_cabo_comercial || c.secao_mm2 || '-'}</td>
              <td className="px-2 py-2 font-mono">{c.disjuntor_sugerido_in ? `${fmt(c.disjuntor_sugerido_in, ' A', 0)} / ${fmt(c.disjuntor_sugerido_icu, ' kA', 1)}` : fmt(c.disjuntor_corrente_nominal || c.disjuntor_a, ' A', 0)}</td>
              <td className="px-2 py-2 font-mono">{fmt(c.queda_tensao_acumulada ?? c.queda_tensao_pct, ' %', 2)}</td>
              <td className="px-2 py-2"><Badge status={statusFinal(c)} /></td>
              <td className="px-2 py-2 max-w-[260px] truncate" title={limparTexto(c.validacao_mensagem || c.selecao_componentes_justificativa, '')}>{limparTexto(c.validacao_mensagem || c.selecao_componentes_justificativa, '-')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelaAreasClassificadas({ areas }) {
  if (!areas?.length) {
    return <div className="text-gray-500">Áreas classificadas não informadas.</div>
  }

  return (
    <div className="overflow-auto rounded-md border border-gray-100">
      <table className="w-full min-w-[980px] text-xs">
        <thead className="bg-primary-900 text-white">
          <tr>
            {['Área', 'Zona', 'Grupo', 'Temp.', 'Equipamento Ex', 'Proteção', 'Grupo Eq.', 'Temp. Eq.', 'Status', 'Justificativa'].map((h) => (
              <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.flatMap((area, areaIndex) => {
            const equipamentos = area.equipamentos?.length ? area.equipamentos : [{ nome_tag: 'não informado', status: area.status, mensagem: area.mensagem }]
            return equipamentos.map((equipamento, equipamentoIndex) => (
              <tr key={`${area.id || areaIndex}-${equipamento.id || equipamentoIndex}`} className="border-b border-gray-100">
                <td className="px-2 py-2 font-medium">{limparTexto(area.nome)}</td>
                <td className="px-2 py-2">{limparTexto(area.zona)}</td>
                <td className="px-2 py-2">{limparTexto(area.grupo)}</td>
                <td className="px-2 py-2">{limparTexto(area.classe_temperatura)}</td>
                <td className="px-2 py-2">{limparTexto(equipamento.nome_tag)}</td>
                <td className="px-2 py-2">{limparTexto(equipamento.tipo_protecao_ex)}</td>
                <td className="px-2 py-2">{limparTexto(equipamento.grupo)}</td>
                <td className="px-2 py-2">{limparTexto(equipamento.classe_temperatura)}</td>
                <td className="px-2 py-2"><Badge status={equipamento.status || area.status} /></td>
                <td className="px-2 py-2 max-w-[280px] truncate" title={limparTexto(equipamento.mensagem || area.mensagem, '')}>{limparTexto(equipamento.mensagem || area.mensagem, '-')}</td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function MemorialProjeto({ projeto, circuitos }) {
  const transformador = parseDados(projeto?.transformador_dados)
  const sistema = calcularSistemaCircuitos(circuitos, parseDados(projeto?.sistema_trifasico_dados), projeto?.tensao_ref)
  const protecaoGeral = protecaoGeralDados(parseDados(projeto?.protecao_geral_dados))
  const paraRaios = parseDados(projeto?.para_raios_dados)
  const aterramento = aterramentoDados(parseDados(projeto?.aterramento_dados))
  const areasClassificadas = parseDados(projeto?.areas_classificadas_dados)
  const resumo = resumoGlobalProjeto(circuitos, protecaoGeral, paraRaios, aterramento, areasClassificadas)
  const iccMax = Math.max(0, ...circuitos.map((c) => Number(c.isc_local || 0)))
  const qtMax = Math.max(0, ...circuitos.map((c) => Number(c.queda_tensao_acumulada ?? c.queda_tensao_pct ?? 0)))
  const criticos = circuitos.filter((c) => statusFinal(c) === 'CRITICO')

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-300 shadow-none">
        <div className="border-b border-slate-200 bg-white px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <FileText size={15} /> Memorial técnico de dimensionamento elétrico
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{limparTexto(projeto?.nome, 'Projeto não informado')}</h1>
              <p className="mt-1 text-sm text-slate-600">{limparTexto(projeto?.cliente, 'Cliente não informado')} · {limparTexto(projeto?.contexto, 'contexto não informado')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Status geral</span>
              <Badge status={resumo.status} />
            </div>
          </div>
        </div>
        <CardBody className="space-y-4">
          <dl className="grid gap-x-6 border-y border-slate-200 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-slate-500">Circuitos</dt><dd className="mt-1 font-semibold text-slate-900">{resumo.total} total · {resumo.ok} OK · {resumo.alertas} alertas · {resumo.criticos} bloqueados</dd></div>
            <div><dt className="text-xs text-slate-500">Módulos revisados</dt><dd className="mt-1 font-semibold text-slate-900">{resumo.modulos_contagem.ok + resumo.modulos_contagem.alerta + resumo.modulos_contagem.critico}</dd></div>
            <div><dt className="text-xs text-slate-500">Maior Icc cadastrada</dt><dd className="mt-1 font-mono font-semibold text-slate-900">{fmt(iccMax || null, ' kA', 2)}</dd></div>
            <div><dt className="text-xs text-slate-500">Maior queda acumulada</dt><dd className="mt-1 font-mono font-semibold text-slate-900">{fmt(qtMax, ' %', 2)}</dd></div>
          </dl>
          <Alert variant={resumo.status === 'CRITICO' ? 'danger' : resumo.status === 'ALERTA' ? 'warning' : 'success'} icon={resumo.status === 'OK' ? CheckCircle2 : AlertTriangle} title="Síntese do memorial e pendências">
            {resumo.motivo_status}
          </Alert>
        </CardBody>
      </Card>
      
      <Secao numero="0" titulo="Critérios de Cálculo de Cabos" status="OK">
        <ul className="list-disc space-y-2 pl-5 text-gray-700">
          <li><b>Ampacidade (NBR 5410 / N-1997):</b> Corrente de projeto corrigida Ib' = Ib / (K1 × K2 × K3). Seleção garantindo ICOND ≥ Ib'.</li>
          <li><b>Queda de Tensão (NBR 5410):</b> ΔV% no trecho e queda acumulada até o equipamento final menor ou igual ao Limite Adotado.</li>
          <li><b>Curto-Circuito (IEC 60909):</b> Verificação do critério térmico S ≥ Icc × √t / K para suportabilidade do cabo.</li>
          <li><b>Proteção (Disjuntor):</b> Coordenação com cabo garantindo In ≥ Ib, In ≤ Iz (proteção de sobrecarga) e Icu ≥ Icc (suportabilidade de curto).</li>
        </ul>
      </Secao>

      <Secao numero="1" titulo="Dados do projeto" status={resumo.status}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Projeto" valor={projeto?.nome} />
          <Linha label="Cliente" valor={projeto?.cliente} />
          <Linha label="Contexto normativo" valor={projeto?.contexto} />
          <Linha label="Tensão de referência" valor={fmt(projeto?.tensao_ref, ' V', 0)} />
          <Linha label="Total de circuitos" valor={resumo.total} />
          <Linha label="Circuitos OK" valor={resumo.ok} />
          <Linha label="Circuitos em ALERTA" valor={resumo.alertas} />
          <Linha label="Circuitos CRÍTICO" valor={resumo.criticos} />
          <Linha label="Módulos OK" valor={resumo.modulos_contagem.ok} />
          <Linha label="Módulos em ALERTA" valor={resumo.modulos_contagem.alerta} />
          <Linha label="Módulos CRÍTICO" valor={resumo.modulos_contagem.critico} />
          <Linha label="Status geral" valor={statusVisual(resumo.status)} />
          <Linha label="Motivo do status geral" valor={resumo.motivo_status} />
        </div>
      </Secao>

      <Secao numero="2" titulo="Entrada de energia" status={transformador.corrente_curto_secundario_ka ? 'OK' : 'ALERTA'}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Tensão primária" valor={fmt(transformador.tensao_primaria, ' V', 0)} />
          <Linha label="Tensão secundária" valor={fmt(transformador.tensao_secundaria, ' V', 0)} />
          <Linha label="Frequência" valor={fmt(transformador.frequencia, ' Hz', 0)} />
          <Linha label="Icc origem" valor={fmt(transformador.corrente_curto_secundario_ka, ' kA', 3)} />
        </div>
      </Secao>

      <Secao numero="3" titulo="Transformador" status={transformador.potencia_kva ? 'OK' : 'ALERTA'}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Potência nominal" valor={fmt(transformador.potencia_kva, ' kVA', 2)} />
          <Linha label="Impedância" valor={fmt(transformador.impedancia_percentual, ' %', 2)} />
          <Linha label="In primário" valor={fmt(transformador.corrente_nominal_primario, ' A', 3)} />
          <Linha label="In secundário" valor={fmt(transformador.corrente_nominal_secundario, ' A', 3)} />
          <Linha label="Ligação primária/secundária" valor={`${transformador.ligacao_primaria || 'não informado'} / ${transformador.ligacao_secundaria || 'não informado'}`} />
          <Linha label="Observações" valor={transformador.observacoes} />
        </div>
      </Secao>

      <Secao numero="4" titulo="Sistema elétrico" status={sistema.potencia_aparente_kva || sistema.corrente_linha ? 'OK' : 'ALERTA'}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Potência nominal das cargas" valor={fmt(sistema.potencia_nominal_cargas_kw, ' kW', 3)} />
          <Linha label="Potência ativa elétrica estimada" valor={fmt(sistema.potencia_ativa_eletrica_kw || sistema.potencia_ativa_kw, ' kW', 3)} />
          <Linha label="Potência aparente" valor={fmt(sistema.potencia_aparente_kva, ' kVA', 3)} />
          <Linha label="Potência reativa" valor={fmt(sistema.potencia_reativa_kvar, ' kvar', 3)} />
          <Linha label="Corrente de linha" valor={fmt(sistema.corrente_linha, ' A', 3)} />
          <Linha label="Fator de potência" valor={fmt(sistema.fator_potencia, '', 4)} />
          <Linha label="Ligação" valor={sistema.ligacao} />
        </div>
      </Secao>

      <Secao numero="5" titulo="Curto-circuito (Icc)" status={iccMax ? 'OK' : 'ALERTA'}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Icc máximo cadastrado" valor={fmt(iccMax || null, ' kA', 2)} />
          <Linha label="Circuitos sem Icc" valor={circuitos.filter((c) => !c.isc_local).length} />
        </div>
      </Secao>

      <Secao numero="6" titulo="Circuitos" status={resumo.status}>
        <TabelaCircuitos circuitos={circuitos} />
      </Secao>

      <Secao numero="7" titulo="Cabos" status={criticos.some((c) => c.validacao_mensagem?.toLowerCase().includes('cabo')) ? 'CRÍTICO' : 'OK'}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Maior queda de tensão calculada" valor={fmt(qtMax, ' %', 2)} />
          <Linha label="Circuitos com cabo sugerido" valor={circuitos.filter((c) => c.cabo_sugerido_tipo_comercial).length} />
        </div>
      </Secao>

      <Secao numero="8" titulo="Disjuntores / Proteções" status={statusMaisGrave([resumo.status_protecao_geral, ...circuitos.map((c) => normalizarStatus(c.protecao_status, 'OK'))])}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Disjuntor geral TAG" valor={protecaoGeral.tag} />
          <Linha label="Disjuntor geral tipo" valor={protecaoGeral.tipo} />
          <Linha label="Disjuntor geral Vn" valor={fmt(protecaoGeral.vn, ' V', 0)} />
          <Linha label="Disjuntor geral In" valor={fmt(protecaoGeral.in, ' A', 0)} />
          <Linha label="Disjuntor geral Icu" valor={fmt(protecaoGeral.icu, ' kA', 1)} />
          <Linha label="Disjuntor geral curva" valor={protecaoGeral.curva} />
          <Linha label="Proteções de circuitos OK" valor={resumo.protecoes.ok} />
          <Linha label="Proteções de circuitos ALERTA" valor={resumo.protecoes.alerta} />
          <Linha label="Proteções de circuitos CRÍTICO" valor={resumo.protecoes.critico} />
        </div>
      </Secao>

      <Secao numero="9" titulo="Para-raios de Linha" status={resumo.status_para_raios}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Identificação / TAG" valor={paraRaios.tag} />
          <Linha label="Ponto de instalação" valor={paraRaios.ponto_instalacao} />
          <Linha label="Vmax" valor={fmt(paraRaios.classe_tensao_vmax, '', 3)} />
          <Linha label="Fator FA" valor={fmt(paraRaios.fator_aterramento_fa, '', 3)} />
          <Linha label="Vn mínimo" valor={fmt(paraRaios.vn_minimo, '', 3)} />
          <Linha label="Vn escolhido" valor={fmt(paraRaios.tensao_nominal_escolhida_vn, '', 3)} />
          <Linha label="Distância de escoamento" valor={fmt(paraRaios.distancia_escoamento, '', 3)} />
          <Linha label="Margem de proteção" valor={fmt(paraRaios.margem_protecao_pct, ' %', 2)} />
          <Linha label="Justificativa" valor={paraRaios.mensagem} />
        </div>
      </Secao>

      <Secao numero="10" titulo="Sistema de Aterramento" status={resumo.status_aterramento}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Tipo de aterramento" valor={aterramento.tipo_aterramento} />
          <Linha label="Finalidade" valor={aterramento.finalidade} />
          <Linha label="Fórmula Wenner" valor={aterramento.formula} />
          <Linha label="Resistividade média" valor={fmt(aterramento.resistividade_media, ' Ω.m', 2)} />
          <Linha label="Menor resistividade" valor={fmt(aterramento.menor_resistividade, ' Ω.m', 2)} />
          <Linha label="Maior resistividade" valor={fmt(aterramento.maior_resistividade, ' Ω.m', 2)} />
          <Linha label="Variação" valor={fmt(aterramento.variacao_percentual, ' %', 2)} />
          <Linha label="Classificação do solo" valor={aterramento.classificacao_solo} />
          <Linha label="Justificativa" valor={aterramento.mensagem} />
        </div>
      </Secao>

      <Secao numero="11" titulo="Áreas Classificadas" status={resumo.status_areas}>
        <div className="mb-3 grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Total de áreas" valor={areasClassificadas.resumo?.total_areas} />
          <Linha label="Equipamentos Ex" valor={areasClassificadas.resumo?.total_equipamentos} />
          <Linha label="Equipamentos críticos" valor={areasClassificadas.resumo?.equipamentos_criticos} />
          <Linha label="Resumo" valor={areasClassificadas.mensagem} />
        </div>
        <TabelaAreasClassificadas areas={areasClassificadas.areas || []} />
      </Secao>

      <Secao numero="12" titulo="Seleção automática" status={circuitos.some((c) => normalizarStatus(c.selecao_componentes_status, 'OK') === 'CRITICO') ? 'CRITICO' : circuitos.some((c) => normalizarStatus(c.selecao_componentes_status, 'OK') === 'ALERTA') ? 'ALERTA' : 'OK'}>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <Linha label="Circuitos automáticos" valor={circuitos.filter((c) => (c.modo_dimensionamento || c.modo_selecao_componentes) === 'automatico').length} />
          <Linha label="Seleções críticas" valor={circuitos.filter((c) => normalizarStatus(c.selecao_componentes_status, 'OK') === 'CRITICO').length} />
        </div>
      </Secao>

      <Secao numero="13" titulo="Validação normativa" status={resumo.status}>
        <div className="space-y-2">
          {circuitos.length ? circuitos.map((c) => (
            <div key={c.id} className="flex gap-3 border-b border-gray-100 pb-2 last:border-b-0">
              <div className="w-40 font-medium">{c.tag || c.descricao}</div>
              <Badge status={c.validacao_status || statusFinal(c)} />
              <div className="flex-1 text-gray-600">{c.validacao_mensagem || 'sem observação técnica'}</div>
            </div>
          )) : <div className="text-gray-500">Nenhum circuito cadastrado.</div>}
        </div>
      </Secao>

      <Secao numero="14" titulo="Conclusão técnica" status={resumo.status}>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          {conclusoes(circuitos, resumo, paraRaios, aterramento, areasClassificadas).map((linha) => <li key={linha}>{linha}</li>)}
        </ul>
      </Secao>
    </div>
  )
}
