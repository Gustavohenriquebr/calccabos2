const VISUAL = {
  NAO_INICIADO: ['não iniciado', 'bg-slate-300', 'text-slate-500'], INCOMPLETO: ['pendente', 'bg-amber-500', 'text-amber-800'],
  PRONTO: ['pronto', 'bg-emerald-600', 'text-emerald-800'], COM_ALERTAS: ['em revisão', 'bg-amber-500', 'text-amber-800'],
  BLOQUEADO: ['bloqueado', 'bg-red-600', 'text-red-800'],
}
const TITULOS = { 'dados-projeto': 'Projeto', entrada: 'Entrada', circuitos: 'Circuitos', revisao: 'Proteções', memorial: 'Memorial' }

export default function ProjectFlowStepper({ fluxo, ativa, onChange }) {
  if (!fluxo?.etapas?.length) return null
  return <section className="border-b border-slate-200 bg-slate-50 px-4 py-2" aria-label="Andamento do projeto">
    <div className="mx-auto flex max-w-[1800px] items-center overflow-x-auto text-xs [&::-webkit-scrollbar]:hidden">
      <span className="mr-3 shrink-0 font-semibold uppercase tracking-wider text-slate-500">Fluxo</span>
      {fluxo.etapas.map((item, index) => {
        const [label, dot, text] = VISUAL[item.status] || VISUAL.NAO_INICIADO
        return <div key={item.id} className="flex shrink-0 items-center">
          {index > 0 && <span className="mx-2 text-slate-300">→</span>}
          <button type="button" onClick={() => onChange(item.destino)} className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${ativa === item.destino ? 'bg-white ring-1 ring-slate-300' : 'hover:bg-white'}`}>
            <span className={`h-2 w-2 rounded-full ${dot}`} /><span className="font-medium text-slate-800">{TITULOS[item.id] || item.titulo}</span><span className={text}>{label}</span>
          </button>
        </div>
      })}
    </div>
  </section>
}
