import { Search, X } from 'lucide-react'

export default function CircuitosToolbar({
  busca,
  setBusca,
  filtroStatus,
  setFiltroStatus,
  filtroModo,
  setFiltroModo,
  filtroProtecao,
  setFiltroProtecao,
  total,
  exibindo,
  limparFiltros,
}) {
  const temFiltro = busca || filtroStatus !== 'TODOS' || filtroModo !== 'TODOS' || filtroProtecao !== 'TODOS'

  return (
    <div className="bg-white border-b border-slate-200 p-3 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input
          type="text"
          placeholder="Buscar TAG, Descricao, Painel..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <select
        value={filtroStatus}
        onChange={(event) => setFiltroStatus(event.target.value)}
        className="py-1.5 px-2 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none focus:border-slate-400 min-w-[120px]"
      >
        <option value="TODOS">Status: Todos</option>
        <option value="OK">Status: OK</option>
        <option value="ALERTA">Status: Alerta</option>
        <option value="CRITICO">Status: Critico</option>
      </select>

      <select
        value={filtroModo}
        onChange={(event) => setFiltroModo(event.target.value)}
        className="py-1.5 px-2 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none focus:border-slate-400 min-w-[120px]"
      >
        <option value="TODOS">Modo: Todos</option>
        <option value="manual">Modo: Manual</option>
        <option value="automatico">Modo: Automatico</option>
      </select>

      <select
        value={filtroProtecao}
        onChange={(event) => setFiltroProtecao(event.target.value)}
        className="py-1.5 px-2 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none focus:border-slate-400 min-w-[120px]"
      >
        <option value="TODOS">Protecao: Todas</option>
        <option value="OK">Protecao: OK</option>
        <option value="ALERTA">Protecao: Alerta</option>
        <option value="CRITICO">Protecao: Critico</option>
      </select>

      {temFiltro && (
        <button
          onClick={limparFiltros}
          className="text-xs text-slate-500 hover:text-slate-800 underline decoration-slate-300 underline-offset-2 transition-colors whitespace-nowrap"
        >
          Limpar filtros
        </button>
      )}

      <div className="ml-auto text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100">
        Exibindo {exibindo} de {total}
      </div>
    </div>
  )
}
