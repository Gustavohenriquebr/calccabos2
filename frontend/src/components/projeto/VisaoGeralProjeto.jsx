import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { StatusBadge } from '../ui'
import { buildProjectHealth, parseDados } from './projectHealth'

function fmt(valor, sufixo = '', casas = 2) {
  const numero = Number(valor)
  return valor === null || valor === undefined || valor === '' || !Number.isFinite(numero) ? 'N/D' : `${Number.isInteger(numero) ? numero : numero.toFixed(casas)}${sufixo}`
}
function Linha({ label, valor }) { return <div className="flex justify-between gap-4 border-b border-[#e6eaee] py-1.5 last:border-0"><dt className="text-sm text-[#606e7d]">{label}</dt><dd className="text-right text-sm font-semibold text-[#121820]">{valor || 'N/D'}</dd></div> }

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`cc-panel ${className}`}>
      <div className="cc-panel-header">
        <h2 className="text-sm font-bold text-[#121820]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[#606e7d]">{subtitle}</p>}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function statusTone(status) {
  if (status === 'OK' || status === 'PRONTO') return { badge: 'OK', cls: 'cc-status-ok', width: 'w-full' }
  if (status === 'BLOQUEADO' || status === 'CRITICO') return { badge: 'Revisar', cls: 'cc-status-bloqueado', width: 'w-2/5' }
  if (status === 'COM_ALERTAS' || status === 'ALERTA' || status === 'INCOMPLETO') return { badge: 'Atenção', cls: 'cc-status-alerta', width: 'w-2/3' }
  return { badge: 'Pendente', cls: 'cc-status-pendente', width: 'w-1/4' }
}

function ProgressRow({ label, status, percent }) {
  const tone = statusTone(status)
  const fill = percent !== undefined ? `${Math.max(0, Math.min(100, percent))}%` : undefined
  return (
    <div className="grid grid-cols-[140px_1fr_48px_82px] items-center gap-2 py-1.5 text-xs">
      <span className="font-semibold text-[#121820]">{label}</span>
      <div className="h-1.5 rounded-full bg-[#edf0f3]">
        <div className={`h-1.5 rounded-full ${tone.cls}`} style={{ width: fill || undefined }} />
      </div>
      <span className="text-right font-medium text-[#606e7d]">{percent ?? 0}%</span>
      <span className={`${tone.cls} px-2 py-1 text-center text-xs font-bold`} style={{ borderRadius: 3 }}>{tone.badge}</span>
    </div>
  )
}

function PendenciaItem({ item }) {
  const tone = statusTone(item.status)
  return (
    <div className="grid grid-cols-[78px_1fr] gap-3 py-1.5">
      <span className={`${tone.cls} px-2 py-1 text-center text-xs font-bold`} style={{ borderRadius: 3 }}>{item.titulo?.split(' ')[0] || 'Item'}</span>
      <div>
        <p className="text-sm font-semibold text-[#121820]">{item.titulo}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[#606e7d]">{item.descricao}</p>
      </div>
    </div>
  )
}

export default function VisaoGeralProjeto({ projeto, circuitos = [], revisoes = [], health, onNavigate, onPrimaryAction, onSaveProject }) {
  const resumo = health || buildProjectHealth(projeto, circuitos)
  const transformador = parseDados(projeto?.transformador_dados)
  const protecao = parseDados(projeto?.protecao_geral_dados)
  const etapas = resumo.fluxo?.etapas || []
  const todosPendentes = [
    ...(resumo.pendencias?.criticas || []),
    ...(resumo.pendencias?.faltantes || []),
    ...(resumo.pendencias?.alertas || []),
  ].slice(0, 4)
  const alertas = [
    ...(resumo.pendencias?.criticas || []),
    ...(resumo.pendencias?.alertas || []),
  ].slice(0, 3)
  const [editando, setEditando] = useState(false)
  const [dados, setDados] = useState({})
  useEffect(() => setDados({
    nome: projeto?.nome || '',
    cliente: projeto?.cliente || '',
    uf: projeto?.uf || '',
    cidade: projeto?.cidade || '',
    concessionaria: projeto?.concessionaria || '',
    contexto: projeto?.contexto || 'industrial',
    tensao_ref: projeto?.tensao_ref || 380,
    revisao: projeto?.revisao || '0',
    responsavelTecnico: projeto?.responsavelTecnico || projeto?.responsavel_tecnico || '',
    descricao: projeto?.descricao || ''
  }), [projeto])
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="cc-title">Visão Geral do Projeto</h1>
        <p className="cc-subtitle">Controle técnico, pendências e rastreabilidade da revisão atual.</p>
      </div>
      <button type="button" onClick={onPrimaryAction} className="cc-button cc-button-primary">
        Continuar configuração <ArrowRight size={15} />
      </button>
    </div>

    <div className="grid gap-4 xl:grid-cols-[340px_1fr_220px]">
      <Panel title="Identificação" subtitle="Dados universais aplicados ao projeto">
        {!editando ? <dl><Linha label="Projeto" valor={projeto?.nome} /><Linha label="Cliente" valor={projeto?.cliente} /><Linha label="UF / Cidade" valor={projeto?.uf || projeto?.cidade ? `${projeto?.uf || ''} / ${projeto?.cidade || ''}` : projeto?.contexto} /><Linha label="Concessionária" valor={projeto?.concessionaria} /><Linha label="Tensão de referência" valor={fmt(projeto?.tensao_ref, ' V', 0)} /><Linha label="Revisão" valor={`Rev. ${projeto?.revisao || '0'}`} /><Linha label="Responsável técnico" valor={projeto?.responsavelTecnico || projeto?.responsavel_tecnico} /></dl> :
          <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); await onSaveProject?.(dados); setEditando(false) }}>
            <label className="cc-label">Nome<input required className="cc-field mt-1 w-full" value={dados.nome || ''} onChange={(e) => setDados({ ...dados, nome: e.target.value })} /></label>
            <label className="cc-label">Cliente<input required className="cc-field mt-1 w-full" value={dados.cliente || ''} onChange={(e) => setDados({ ...dados, cliente: e.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="cc-label">UF<input maxLength={2} className="cc-field mt-1 w-full uppercase" value={dados.uf || ''} onChange={(e) => setDados({ ...dados, uf: e.target.value.toUpperCase() })} /></label>
              <label className="cc-label">Cidade<input className="cc-field mt-1 w-full" value={dados.cidade || ''} onChange={(e) => setDados({ ...dados, cidade: e.target.value })} /></label>
            </div>
            <label className="cc-label">Concessionária<input className="cc-field mt-1 w-full" value={dados.concessionaria || ''} onChange={(e) => setDados({ ...dados, concessionaria: e.target.value })} /></label>
            <label className="cc-label">Contexto<select className="cc-field mt-1 w-full" value={dados.contexto} onChange={(e) => setDados({ ...dados, contexto: e.target.value })}><option value="residencial">Residencial</option><option value="comercial">Comercial</option><option value="industrial">Industrial</option><option value="hospitalar">Hospitalar</option><option value="offshore">Offshore</option></select></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="cc-label">Tensão ref. (V)<input required type="number" className="cc-field mt-1 w-full" value={dados.tensao_ref || ''} onChange={(e) => setDados({ ...dados, tensao_ref: Number(e.target.value) })} /></label>
              <label className="cc-label">Revisão<input className="cc-field mt-1 w-full" value={dados.revisao || ''} onChange={(e) => setDados({ ...dados, revisao: e.target.value })} /></label>
            </div>
            <label className="cc-label">Responsável técnico<input className="cc-field mt-1 w-full" value={dados.responsavelTecnico || ''} onChange={(e) => setDados({ ...dados, responsavelTecnico: e.target.value })} /></label>
            <button className="cc-button cc-button-primary">Salvar dados do projeto</button>
          </form>}
        <button type="button" onClick={() => setEditando(!editando)} className="mt-3 text-xs font-bold text-[#0e5992]">{editando ? 'Cancelar edição' : 'Editar identificação'}</button>
      </Panel>

      <Panel title="Progresso técnico por disciplina" subtitle="Módulos técnicos sempre visíveis">
        <div className="space-y-1">
          {[
            ['Entrada', resumo.statusModulos?.transformador, transformador.potencia_kva ? 80 : 25],
            ['Circuitos', etapas.find((e) => e.id === 'circuitos')?.status, resumo.circuitos.total ? Math.round((resumo.circuitos.ok / resumo.circuitos.total) * 100) : 0],
            ['Proteções', resumo.statusModulos?.protecaoGeral || etapas.find((e) => e.id === 'revisao')?.status, protecao.in && protecao.icu ? 70 : 35],
            ['Unifilar', circuitoTotalPercent(resumo.circuitos.total), resumo.circuitos.total ? 55 : 20],
            ['Aterramento', resumo.statusModulos?.aterramento, resumo.statusModulos?.aterramento === 'OK' ? 100 : 20],
            ['Para-raios', resumo.statusModulos?.paraRaios, resumo.statusModulos?.paraRaios === 'OK' ? 100 : 0],
            ['Áreas Classificadas', resumo.statusModulos?.areas, resumo.statusModulos?.areas === 'OK' ? 100 : 0],
            ['Memorial', etapas.find((e) => e.id === 'memorial')?.status, resumo.fluxo?.relatorioFinalLiberado ? 100 : 18],
          ].map(([label, status, percent]) => <ProgressRow key={label} label={label} status={status} percent={percent} />)}
        </div>
      </Panel>

      <Panel title="Resumo dos circuitos" subtitle="Situação da base atual">
        <dl>
          <Linha label="Total" valor={String(resumo.circuitos.total)} />
          <Linha label="OK" valor={String(resumo.circuitos.ok)} />
          <Linha label="Com alerta" valor={String(resumo.circuitos.alerta)} />
          <Linha label="Bloqueados" valor={String(resumo.circuitos.critico)} />
          <Linha label="Não avaliados" valor={String(resumo.fluxo?.naoAvaliados || 0)} />
          <Linha label="Maior queda" valor={fmt(resumo.maiorQt, ' %')} />
        </dl>
      </Panel>
    </div>

    <div className="grid gap-4 xl:grid-cols-[340px_1fr_220px]">
      <Panel title="Pendências de dados" subtitle="Itens necessários antes do memorial">
        {todosPendentes.length ? todosPendentes.map((item) => <PendenciaItem key={`${item.titulo}-${item.descricao}`} item={item} />) : <p className="text-xs text-[#606e7d]">Sem pendências de dados para a revisão atual.</p>}
      </Panel>

      <Panel title="Alertas técnicos" subtitle="Validações discretas por severidade">
        {alertas.length ? alertas.map((item) => (
          <div key={`${item.titulo}-${item.descricao}`} className="grid grid-cols-[64px_1fr_70px] items-start gap-3 border-b border-[#e6eaee] py-2 last:border-0">
            <span className={`${statusTone(item.status).cls} px-2 py-1 text-center text-xs font-bold`} style={{ borderRadius: 3 }}>{item.status === 'CRITICO' ? 'Erro' : 'Atenção'}</span>
            <p className="text-sm font-semibold leading-5 text-[#121820]">{item.titulo}: <span className="font-medium">{item.descricao}</span></p>
            <span className="text-xs text-[#606e7d]">{item.tipo || 'Projeto'}</span>
          </div>
        )) : <p className="text-xs text-[#606e7d]">Nenhum alerta técnico ativo.</p>}
      </Panel>

      <Panel title="Critérios ativos" subtitle="Base da revisão">
        <dl>
          <Linha label="Norma base" valor="NBR 5410" />
          <Linha label="Localidade" valor={projeto?.uf || projeto?.contexto} />
          <Linha label="Rede" valor={projeto?.tensao_ref ? `${projeto.tensao_ref} V` : 'N/D'} />
          <Linha label="Entrada nominal" valor={fmt(transformador.potencia_kva, ' kVA')} />
          <Linha label="Status geral" valor={<StatusBadge status={resumo.statusGeral} />} />
        </dl>
      </Panel>
    </div>

    <Panel title="Últimas revisões" subtitle="Histórico técnico do projeto">
      {revisoes.length ? <div className="grid gap-2 text-sm md:grid-cols-3">
        {revisoes.slice(0, 6).map((item) => (
          <div key={item.id || `${item.revisao}-${item.criado_em}`} className="border border-[#e6eaee] bg-[#fbfcfd] p-3">
            <span className="font-bold text-[#0e5992]">REV. {item.revisao || '0'}</span>
            <p className="mt-1 text-[#121820]">Campos alterados: {(item.camposAlterados || []).join(', ') || 'Dados do projeto'}</p>
            <p className="mt-1 text-xs text-[#606e7d]">{item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : 'Data não informada'}</p>
          </div>
        ))}
      </div> : <p className="text-sm text-[#606e7d]">Nenhuma alteração registrada nesta revisão ou o histórico ampliado não está disponível no plano atual.</p>}
    </Panel>

  </div>
}

function circuitoTotalPercent(total) {
  return total ? 'ALERTA' : 'PENDENTE'
}
