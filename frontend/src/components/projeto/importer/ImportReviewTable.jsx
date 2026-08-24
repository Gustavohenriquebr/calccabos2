import { RotateCcw, Trash2 } from 'lucide-react'

const EDITABLE_FIELDS = [
  { key: 'descricao', label: 'Descricao', type: 'text', required: true, className: 'min-w-[220px]' },
  { key: 'tag', label: 'TAG', type: 'text', className: 'min-w-[110px]' },
  { key: 'potencia_kw', label: 'kW', type: 'number', required: true, className: 'min-w-[90px]' },
  { key: 'tensao', label: 'V', type: 'number', required: true, className: 'min-w-[90px]' },
  { key: 'fator_potencia', label: 'FP', type: 'number', required: true, className: 'min-w-[90px]' },
  { key: 'distancia_m', label: 'm', type: 'number', required: true, className: 'min-w-[90px]' },
  { key: 'tipo_cabo', label: 'Cabo', type: 'select', options: ['CU-PVC', 'CU-XLPE', 'AL-PVC', 'AL-XLPE'], className: 'min-w-[110px]' },
  { key: 'metodo_instalacao', label: 'Metodo', type: 'select', options: ['TRAY', 'CONDUIT', 'DIRECT', 'AIR'], className: 'min-w-[120px]' },
  { key: 'temp_ambiente', label: 'Temp.', type: 'number', className: 'min-w-[90px]' },
  { key: 'fases', label: 'Fases', type: 'number', className: 'min-w-[80px]' },
  { key: 'agrupamento', label: 'Agrup.', type: 'number', className: 'min-w-[80px]' },
  { key: 'formacao', label: 'Form.', type: 'number', className: 'min-w-[80px]' },
  { key: 'isc_local', label: 'Isc kA', type: 'number', className: 'min-w-[90px]' },
  { key: 'tempo_atuacao', label: 'Tempo s', type: 'number', className: 'min-w-[90px]' },
  { key: 'disjuntor_corrente_nominal', label: 'Dj In', type: 'number', className: 'min-w-[90px]' },
  { key: 'disjuntor_icu', label: 'Dj Icu', type: 'number', className: 'min-w-[90px]' },
  { key: 'disjuntor_curva', label: 'Curva', type: 'select', options: ['B', 'C', 'D'], className: 'min-w-[90px]' },
  { key: 'disjuntor_fabricante', label: 'Fabricante', type: 'text', className: 'min-w-[130px]' },
]

function valueForInput(value) {
  if (value === null || value === undefined) return ''
  return value
}

export default function ImportReviewTable({
  rows,
  stats,
  replaceExisting,
  onReplaceExistingChange,
  onEditRow,
  onRemoveRow,
  onRestoreRow,
  onRemoveAllRows,
  onRestoreAllRows,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
          <p className="text-lg font-bold text-slate-700">{stats.total}</p>
          <p className="text-xs text-slate-500">linhas na planilha</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <p className="text-lg font-bold text-emerald-600">{stats.valid}</p>
          <p className="text-xs text-emerald-700">prontas</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
          <p className="text-lg font-bold text-red-600">{stats.invalid}</p>
          <p className="text-xs text-red-700">com erro</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
          <p className="text-lg font-bold text-slate-500">{stats.removed}</p>
          <p className="text-xs text-slate-500">removidas</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(event) => onReplaceExistingChange(event.target.checked)}
          />
          Excluir todos os circuitos atuais do projeto antes de importar
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRestoreAllRows}
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw size={12} />
            Restaurar linhas
          </button>
          <button
            type="button"
            onClick={onRemoveAllRows}
            className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100"
          >
            <Trash2 size={12} />
            Excluir todas da importacao
          </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="max-h-[430px] overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky top-0 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">Linha</th>
                <th className="sticky top-0 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">Status</th>
                {EDITABLE_FIELDS.map((field) => (
                  <th key={field.key} className={`sticky top-0 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600 ${field.className}`}>
                    {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                <th className="sticky top-0 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">Acao</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const disabled = row.removed
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 ${disabled ? 'bg-slate-100 opacity-70' : row.valido ? 'bg-white' : 'bg-red-50'}`}
                  >
                    <td className="px-2 py-1.5 text-slate-500">{row.linha}</td>
                    <td className="px-2 py-1.5">
                      {disabled ? (
                        <span className="text-slate-500">Removida</span>
                      ) : row.valido ? (
                        <span className="text-emerald-600 font-medium">OK</span>
                      ) : (
                        <span className="text-red-600" title={row.erros.join(' | ')}>
                          {row.erros[0]}
                        </span>
                      )}
                    </td>
                    {EDITABLE_FIELDS.map((field) => (
                      <td key={`${row.id}-${field.key}`} className="px-2 py-1.5">
                        {field.type === 'select' ? (
                          <select
                            value={valueForInput(row.circuito[field.key])}
                            disabled={disabled}
                            onChange={(event) => onEditRow(row.id, field.key, event.target.value)}
                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 disabled:bg-slate-100"
                          >
                            <option value="">-</option>
                            {field.options.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            step={field.type === 'number' ? 'any' : undefined}
                            value={valueForInput(row.circuito[field.key])}
                            disabled={disabled}
                            onChange={(event) => onEditRow(row.id, field.key, event.target.value)}
                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 disabled:bg-slate-100"
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      {disabled ? (
                        <button
                          type="button"
                          onClick={() => onRestoreRow(row.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-600 hover:bg-slate-200"
                        >
                          <RotateCcw size={12} />
                          Restaurar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRemoveRow(row.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
