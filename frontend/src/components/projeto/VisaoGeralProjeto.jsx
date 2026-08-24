import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { StatusBadge } from '../ui'
import CentralPendencias from './CentralPendencias'
import LocalidadeProjeto from './LocalidadeProjeto'
import { buildProjectHealth, parseDados } from './projectHealth'

function fmt(valor, sufixo = '', casas = 2) {
  const numero = Number(valor)
  return valor === null || valor === undefined || valor === '' || !Number.isFinite(numero) ? 'N/D' : `${Number.isInteger(numero) ? numero : numero.toFixed(casas)}${sufixo}`
}
function Linha({ label, valor }) { return <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0"><dt className="text-sm text-slate-500">{label}</dt><dd className="text-right text-sm font-medium text-slate-900">{valor || 'N/D'}</dd></div> }

export default function VisaoGeralProjeto({ projeto, circuitos = [], health, onNavigate, onPrimaryAction, onSaveProject }) {
  const resumo = health || buildProjectHealth(projeto, circuitos)
  const transformador = parseDados(projeto?.transformador_dados)
  const [editando, setEditando] = useState(false)
  const [dados, setDados] = useState({})
  useEffect(() => setDados({ nome: projeto?.nome || '', cliente: projeto?.cliente || '', contexto: projeto?.contexto || 'industrial', tensao_ref: projeto?.tensao_ref || 380, descricao: projeto?.descricao || '' }), [projeto])
  return <div className="mx-auto max-w-[1500px] space-y-5">
    <section className="flex flex-col gap-3 border border-slate-300 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="font-semibold text-slate-900">Situação do projeto</span><StatusBadge status={resumo.statusGeral} /><span className="text-slate-600">{resumo.circuitos.total} circuitos</span><span className="text-slate-600">{resumo.circuitos.critico} bloqueados</span><span className="text-slate-600">{resumo.fluxo?.naoAvaliados || 0} não avaliados</span></div>
      <button type="button" onClick={onPrimaryAction} className="flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-950">Próximo: {resumo.fluxo?.proximaAcao?.label || 'continuar'} <ArrowRight size={15} /></button>
    </section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">Dados do projeto</h2><p className="text-xs text-slate-500">Identificação e referências gerais.</p></div><button type="button" onClick={() => setEditando(!editando)} className="text-sm font-medium text-blue-800">{editando ? 'Cancelar' : 'Editar'}</button></div>
        {!editando ? <dl className="px-4 py-2"><Linha label="Projeto" valor={projeto?.nome} /><Linha label="Cliente" valor={projeto?.cliente} /><Linha label="Contexto" valor={projeto?.contexto} /><Linha label="Tensão de referência" valor={fmt(projeto?.tensao_ref, ' V', 0)} /></dl> :
          <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); await onSaveProject?.(dados); setEditando(false) }}>
            <label className="text-xs font-medium text-slate-600">Nome<input required className="input mt-1 w-full" value={dados.nome || ''} onChange={(e) => setDados({ ...dados, nome: e.target.value })} /></label><label className="text-xs font-medium text-slate-600">Cliente<input required className="input mt-1 w-full" value={dados.cliente || ''} onChange={(e) => setDados({ ...dados, cliente: e.target.value })} /></label>
            <label className="text-xs font-medium text-slate-600">Contexto<select className="input mt-1 w-full" value={dados.contexto} onChange={(e) => setDados({ ...dados, contexto: e.target.value })}><option value="residencial">Residencial</option><option value="comercial">Comercial</option><option value="industrial">Industrial</option><option value="hospitalar">Hospitalar</option><option value="offshore">Offshore</option></select></label><label className="text-xs font-medium text-slate-600">Tensão de referência (V)<input required type="number" className="input mt-1 w-full" value={dados.tensao_ref || ''} onChange={(e) => setDados({ ...dados, tensao_ref: Number(e.target.value) })} /></label>
            <button className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white sm:col-span-2">Salvar dados do projeto</button>
          </form>}
      </section>
      <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Resumo técnico</h2><p className="text-xs text-slate-500">Indicadores consolidados para revisão.</p></div><dl className="px-4 py-2"><Linha label="Circuitos prontos" valor={`${resumo.circuitos.ok} de ${resumo.circuitos.total}`} /><Linha label="Circuitos com alerta" valor={String(resumo.circuitos.alerta)} /><Linha label="Maior queda de tensão" valor={fmt(resumo.maiorQt, ' %')} /><Linha label="Maior Icc informada" valor={fmt(resumo.maiorIcc, ' kA')} /><Linha label="Entrada nominal" valor={fmt(transformador.potencia_kva, ' kVA')} /></dl></section>
    </div>
    <LocalidadeProjeto projeto={projeto} />
    <section><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Pendências do projeto</h2><button onClick={() => onNavigate?.('revisao-tecnica')} className="text-sm font-medium text-blue-800">Abrir revisão técnica</button></div><CentralPendencias health={resumo} /></section>
    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4"><button onClick={() => onNavigate?.('circuitos')} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">Ver circuitos</button><button onClick={() => onNavigate?.('protecoes')} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">Ver proteções</button><button onClick={() => onNavigate?.('memorial')} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">Abrir memorial</button></div>
  </div>
}
