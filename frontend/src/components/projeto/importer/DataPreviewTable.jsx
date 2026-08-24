function cellText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export default function DataPreviewTable({ rows, headerRowIndex = 0, maxRows = 12 }) {
  const safeRows = Array.isArray(rows) ? rows : []
  const previewRows = safeRows.slice(0, maxRows)
  const maxColumns = previewRows.reduce((acc, row) => Math.max(acc, Array.isArray(row) ? row.length : 0), 0)

  if (!previewRows.length || maxColumns === 0) {
    return (
      <div className="border border-slate-200 rounded-lg px-4 py-6 text-center text-xs text-slate-500 bg-slate-50">
        Sem dados para pre-visualizacao.
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
        Pre-visualizacao ({previewRows.length} primeiras linhas)
      </div>
      <div className="overflow-auto max-h-[340px]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-2 py-2 text-left font-semibold text-slate-500 w-16">Linha</th>
              {Array.from({ length: maxColumns }).map((_, colIndex) => (
                <th key={`header-col-${colIndex}`} className="px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                  Coluna {colIndex + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIndex) => {
              const isHeader = rowIndex === headerRowIndex
              return (
                <tr
                  key={`preview-row-${rowIndex}`}
                  className={isHeader ? 'bg-blue-50 border-b border-blue-100' : 'border-b border-slate-100'}
                >
                  <td className="px-2 py-1.5 font-medium text-slate-500">{rowIndex + 1}</td>
                  {Array.from({ length: maxColumns }).map((_, colIndex) => (
                    <td
                      key={`cell-${rowIndex}-${colIndex}`}
                      className={`px-2 py-1.5 align-top ${isHeader ? 'font-semibold text-blue-800' : 'text-slate-700'}`}
                    >
                      {cellText(row?.[colIndex]) || <span className="text-slate-300">-</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
