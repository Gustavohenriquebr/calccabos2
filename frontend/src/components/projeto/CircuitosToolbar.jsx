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
  filtroQuadro,
  setFiltroQuadro,
  filtroAmbiente,
  setFiltroAmbiente,
  filtroTipoCarga,
  setFiltroTipoCarga,
  opcoesQuadro = [],
  opcoesAmbiente = [],
  opcoesTipoCarga = [],
  total,
  exibindo,
  limparFiltros,
}) {
  const temFiltro = busca || filtroStatus !== 'TODOS' || filtroModo !== 'TODOS' || filtroProtecao !== 'TODOS' || filtroQuadro !== 'TODOS' || filtroAmbiente !== 'TODOS' || filtroTipoCarga !== 'TODOS'

  return (
    <div className="border-b border-[#d2d9e0] bg-white p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_92px]">
      <label className="cc-label">
        Busca técnica
        <div className="relative mt-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input
          type="text"
          placeholder="Circuito, descrição, quadro ou carga..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="cc-field pl-8"
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
      </label>

      <label className="cc-label">
        Quadro
      <select
        value={filtroQuadro}
        onChange={(event) => setFiltroQuadro(event.target.value)}
        className="cc-field mt-1"
      >
        <option value="TODOS">Todos</option>
        {opcoesQuadro.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      </label>

      <label className="cc-label">
        Ambiente
      <select
        value={filtroAmbiente}
        onChange={(event) => setFiltroAmbiente(event.target.value)}
        className="cc-field mt-1"
      >
        <option value="TODOS">Todos</option>
        {opcoesAmbiente.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      </label>

      <label className="cc-label">
        Tipo de carga
        <select
          value={filtroTipoCarga}
          onChange={(event) => setFiltroTipoCarga(event.target.value)}
          className="cc-field mt-1"
        >
          <option value="TODOS">Todos</option>
          {opcoesTipoCarga.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="cc-label">
        Status
      <select
        value={filtroStatus}
        onChange={(event) => setFiltroStatus(event.target.value)}
        className="cc-field mt-1"
      >
        <option value="TODOS">Todos</option>
        <option value="OK">OK</option>
        <option value="ALERTA">Alerta</option>
        <option value="CRITICO">Bloqueado</option>
      </select>
      </label>

      <div className="flex items-end">
        {temFiltro ? (
        <button
          onClick={limparFiltros}
          className="cc-button w-full"
        >
          Limpar
        </button>
        ) : (
          <div className="cc-status-pendente w-full px-2 py-2 text-center text-xs font-bold" style={{ borderRadius: 3 }}>
            {exibindo}/{total}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
