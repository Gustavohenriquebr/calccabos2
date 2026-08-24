function confidenceLabel(level) {
  if (level === 'alto') return 'Alto'
  if (level === 'medio') return 'Medio'
  return '-'
}

function confidenceColor(level) {
  if (level === 'alto') return 'text-emerald-600'
  if (level === 'medio') return 'text-amber-600'
  return 'text-slate-400'
}

export default function ColumnMapper({
  fields,
  headers,
  mapping,
  confidence,
  onChangeMapping,
  onAutoMap,
}) {
  const requiredMissing = fields.filter((field) => field.required && !mapping[field.key])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600">
          Revise o mapeamento automatico e ajuste manualmente quando necessario.
        </p>
        <button
          type="button"
          onClick={onAutoMap}
          className="text-xs px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-700"
        >
          Remapear automaticamente
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-1/3">Campo do sistema</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-1/3">Coluna da planilha</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-1/3">Confianca</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const notMapped = field.required && !mapping[field.key]
              return (
                <tr
                  key={field.key}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} ${notMapped ? 'bg-amber-50' : ''}`}
                >
                  <td className="px-3 py-2 text-slate-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(event) => onChangeMapping(field.key, event.target.value)}
                      className={`w-full py-1.5 px-2 border rounded bg-white focus:outline-none focus:ring-1 ${
                        notMapped
                          ? 'border-amber-300 focus:ring-amber-400'
                          : 'border-slate-200 focus:ring-blue-400'
                      }`}
                    >
                      <option value="">-- {field.required ? 'selecionar' : 'nao mapear'} --</option>
                      {headers.map((header) => (
                        <option key={`${field.key}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`px-3 py-2 font-medium ${confidenceColor(confidence[field.key])}`}>
                    {confidenceLabel(confidence[field.key])}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {requiredMissing.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Mapeie todos os campos obrigatorios antes de validar/importar.
        </div>
      )}
    </div>
  )
}
