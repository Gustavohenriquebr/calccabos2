import { ArrowDownToLine, CloudLightning, FileText, Flame, LayoutDashboard, Share2, Shield, TableProperties, Zap } from 'lucide-react'

const MODULOS = [
  ['visao-geral', 'Visão Geral', LayoutDashboard],
  ['transformador', 'Entrada', Zap],
  ['circuitos', 'Circuitos', TableProperties],
  ['protecoes', 'Proteções', Shield],
  ['diagrama-unifilar', 'Unifilar', Share2],
  ['aterramento', 'Aterramento', ArrowDownToLine],
  ['para-raios', 'Para-raios', CloudLightning],
  ['areas-classificadas', 'Áreas Classificadas', Flame],
  ['memorial', 'Memorial', FileText],
  ['exportacoes', 'Relatórios', FileText],
]

function Tab({ item: [id, label, Icon], ativa, onChange }) {
  const ativo = ativa === id
  return (
    <button
      type="button"
      data-testid={`aba-${id}`}
      onClick={() => onChange(id)}
      className={`flex h-9 w-full items-center gap-2 px-2 text-left text-xs transition ${
        ativo
          ? 'bg-[#25394c] font-bold text-white'
          : 'text-[#bac7d4] hover:bg-[#1b2a39] hover:text-white'
      }`}
      style={{ borderRadius: 4 }}
    >
      <Icon size={14} className={ativo ? 'text-white' : 'text-[#8fa1b3]'} />
      <span className="truncate">{label}</span>
    </button>
  )
}

export default function ProjetoTabs({ ativa, onChange, projeto, health }) {
  return (
    <aside className="flex h-screen w-44 shrink-0 flex-col bg-[#13202e] px-3 py-4 text-white" aria-label="Módulos do projeto">
      <div>
        <div className="text-[14px] font-bold leading-5">CalcCabos</div>
        <div className="mt-0.5 text-xs text-[#b8c7d6]">Projeto elétrico</div>
        <div className="mt-4 h-px bg-[#2e3d4d]" />
      </div>

      <nav className="mt-3 space-y-1.5">
        {MODULOS.map((item) => <Tab key={item[0]} item={item} ativa={ativa} onChange={onChange} />)}
      </nav>

      <div className="mt-auto border border-[#334557] bg-[#1b2a39] p-2" style={{ borderRadius: 4 }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold">REV. {projeto?.revisao || '0'}</span>
          <span className="cc-status-alerta px-1.5 py-0.5 text-xs font-bold" style={{ borderRadius: 3 }}>
            {health?.statusGeral === 'OK' ? 'Validado' : 'Em revisão'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-4 text-[#b2c2d1]">Dados rastreáveis por disciplina</p>
      </div>
    </aside>
  )
}
