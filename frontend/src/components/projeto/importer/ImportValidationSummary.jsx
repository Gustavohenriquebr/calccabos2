export default function ImportValidationSummary({ validation, limit = 20 }) {
  const summary = validation?.summary || { total: 0, validas: 0, invalidas: 0 }
  const invalidRows = validation?.invalidRows || []
  const mappingErrors = validation?.mappingErrors || []
  const ignoredByFilter = Number(summary.ignoradasPorFiltro || validation?.filterStats?.ignored || 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
          <p className="text-xl font-bold text-slate-700">{summary.total}</p>
          <p className="text-xs text-slate-500">linhas analisadas</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{summary.validas}</p>
          <p className="text-xs text-emerald-700">linhas validas</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
          <p className="text-xl font-bold text-red-600">{summary.invalidas}</p>
          <p className="text-xs text-red-700">linhas com erro</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <p className="text-xl font-bold text-amber-700">{ignoredByFilter}</p>
          <p className="text-xs text-amber-700">ignoradas por filtro</p>
        </div>
      </div>

      {mappingErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {mappingErrors.map((error) => (
            <p key={error}>- {error}</p>
          ))}
        </div>
      )}

      {invalidRows.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
            Resumo de erros (primeiras {Math.min(limit, invalidRows.length)} linhas)
          </div>
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 w-20">Linha</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Erros</th>
                </tr>
              </thead>
              <tbody>
                {invalidRows.slice(0, limit).map((row) => (
                  <tr key={`invalid-row-${row.linha}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{row.linha}</td>
                    <td className="px-3 py-2 text-red-600">{row.erros.join(' | ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary.total === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Nenhuma linha de dados foi encontrada apos limpeza e escolha de cabecalho.
        </div>
      )}
    </div>
  )
}
