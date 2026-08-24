import { Activity, ArrowDownToLine, CloudLightning, FileText, Flame, LayoutDashboard, Share2, Shield, TableProperties, Zap } from 'lucide-react'

const PRINCIPAIS = [
  ['visao-geral', 'Visão Geral', LayoutDashboard], ['transformador', 'Entrada', Zap],
  ['circuitos', 'Circuitos', TableProperties], ['protecoes', 'Proteções', Shield],
  ['diagrama-unifilar', 'Unifilar', Share2], ['aterramento', 'Aterramento', ArrowDownToLine],
  ['memorial', 'Memorial', FileText], ['exportacoes', 'Relatórios', FileText],
]
const COMPLEMENTARES = [
  ['sistema-trifasico', 'Sistema Elétrico', Activity], ['para-raios', 'Para-raios', CloudLightning],
  ['areas-classificadas', 'Áreas Classificadas', Flame], ['revisao-tecnica', 'Revisão Técnica', Shield],
]

function Tab({ item: [id, label, Icon], ativa, onChange, secondary }) {
  const ativo = ativa === id
  return <button type="button" data-testid={`aba-${id}`} onClick={() => onChange(id)} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${ativo ? 'border-blue-700 font-semibold text-blue-800' : `border-transparent ${secondary ? 'text-slate-500' : 'text-slate-700'} hover:border-slate-300 hover:text-slate-950`}`}><Icon size={15} className={ativo ? 'text-blue-700' : 'text-slate-400'} />{label}</button>
}

export default function ProjetoTabs({ ativa, onChange }) {
  return <nav className="sticky top-0 z-20 border-b border-slate-300 bg-white" aria-label="Módulos do projeto">
    <div className="mx-auto max-w-[1800px] px-4">
      <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden">{PRINCIPAIS.map((item) => <Tab key={item[0]} item={item} ativa={ativa} onChange={onChange} />)}</div>
      <div className="flex overflow-x-auto border-t border-slate-100 [&::-webkit-scrollbar]:hidden" aria-label="Módulos complementares">
        <span className="shrink-0 py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Complementares</span>
        {COMPLEMENTARES.map((item) => <Tab key={item[0]} item={item} ativa={ativa} onChange={onChange} secondary />)}
      </div>
    </div>
  </nav>
}
