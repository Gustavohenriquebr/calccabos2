import { Settings2 } from 'lucide-react'

function summarizeRow(row = []) {
  const preview = row
    .map((cell) => (cell === null || cell === undefined ? '' : String(cell).trim()))
    .filter(Boolean)
    .slice(0, 3)
    .join(' | ')
  return preview || '(linha vazia)'
}

export default function SheetSelector({
  sheets,
  selectedSheetName,
  onSelectSheet,
  headerRowIndex,
  onHeaderRowChange,
  options,
  onOptionsChange,
  selectedSheetRows,
}) {
  const headerCandidates = (selectedSheetRows || []).slice(0, 20)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Aba da planilha</label>
          <select
            value={selectedSheetName}
            onChange={(event) => onSelectSheet(event.target.value)}
            className="w-full py-2 px-3 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name} ({sheet.rowCount} linhas)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Linha do cabecalho</label>
          <select
            value={headerRowIndex}
            onChange={(event) => onHeaderRowChange(Number(event.target.value))}
            className="w-full py-2 px-3 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {headerCandidates.map((row, index) => (
              <option key={`header-row-${index}`} value={index}>
                Linha {index + 1} - {summarizeRow(row)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Settings2 size={14} className="text-slate-500" />
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Limpeza de dados</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.removeEmptyRows}
              onChange={(event) => onOptionsChange({ ...options, removeEmptyRows: event.target.checked })}
            />
            Remover linhas vazias
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.removeEmptyColumns}
              onChange={(event) => onOptionsChange({ ...options, removeEmptyColumns: event.target.checked })}
            />
            Remover colunas vazias
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.trimValues}
              onChange={(event) => onOptionsChange({ ...options, trimValues: event.target.checked })}
            />
            Limpar espacos extras
          </label>
        </div>
      </div>
    </div>
  )
}
