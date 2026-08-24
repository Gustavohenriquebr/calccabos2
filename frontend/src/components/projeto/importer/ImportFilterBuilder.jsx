import { Filter, Plus, Trash2 } from 'lucide-react'
import DataPreviewTable from './DataPreviewTable'
import { FILTER_OPERATORS, createImportFilterRule } from '../../../utils/excelImport'

const NEEDS_VALUE = new Set(['contains', 'not_contains', 'equals', 'not_equals', 'greater_than', 'less_than', 'between'])

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function ImportFilterBuilder({
  headers,
  rules,
  onRulesChange,
  filterStats,
  filteredRows,
  headerRowIndex,
}) {
  const safeHeaders = Array.isArray(headers) ? headers : []
  const safeRules = Array.isArray(rules) ? rules : []

  function addRule() {
    onRulesChange([
      ...safeRules,
      createImportFilterRule({ column: safeHeaders[0] || '' }),
    ])
  }

  function updateRule(ruleId, patch) {
    onRulesChange(safeRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)))
  }

  function removeRule(ruleId) {
    onRulesChange(safeRules.filter((rule) => rule.id !== ruleId))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-500" />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Filtros antes da importacao</h3>
              <p className="text-xs text-slate-500">
                Refine as linhas da planilha antes de mapear e validar os circuitos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            disabled={!safeHeaders.length}
          >
            <Plus size={13} />
            Adicionar filtro
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 text-xs sm:grid-cols-4">
          <div className="bg-slate-50 px-3 py-2">
            <p className="font-semibold text-slate-700">{filterStats?.total || 0}</p>
            <p className="text-slate-500">linhas lidas</p>
          </div>
          <div className="bg-slate-50 px-3 py-2">
            <p className="font-semibold text-slate-700">{filterStats?.activeFilters || 0}</p>
            <p className="text-slate-500">filtros ativos</p>
          </div>
          <div className="bg-slate-50 px-3 py-2">
            <p className="font-semibold text-emerald-700">{filterStats?.kept || 0}</p>
            <p className="text-slate-500">linhas mantidas</p>
          </div>
          <div className="bg-slate-50 px-3 py-2">
            <p className="font-semibold text-amber-700">{filterStats?.ignored || 0}</p>
            <p className="text-slate-500">ignoradas por filtro</p>
          </div>
        </div>

        <div className="space-y-2 p-3">
          {safeRules.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
              Nenhum filtro aplicado. Todas as linhas serao consideradas na validacao.
            </div>
          )}

          {safeRules.map((rule, index) => {
            const needsValue = NEEDS_VALUE.has(rule.operator)
            const needsSecondValue = rule.operator === 'between'
            return (
              <div
                key={rule.id}
                className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs md:grid-cols-[1fr_150px_1fr_1fr_auto]"
              >
                <select
                  value={rule.column}
                  onChange={(event) => updateRule(rule.id, { column: event.target.value })}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400"
                  aria-label={`Coluna do filtro ${index + 1}`}
                >
                  {safeHeaders.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(event) => updateRule(rule.id, { operator: event.target.value })}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400"
                  aria-label={`Operador do filtro ${index + 1}`}
                >
                  {FILTER_OPERATORS.map((operator) => (
                    <option key={operator.key} value={operator.key}>{operator.label}</option>
                  ))}
                </select>

                <input
                  value={rule.value || ''}
                  onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                  disabled={!needsValue}
                  placeholder={needsValue ? 'valor' : 'sem valor'}
                  className={cn(
                    'rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400',
                    !needsValue && 'bg-slate-100 text-slate-400',
                  )}
                />

                <input
                  value={rule.valueTo || ''}
                  onChange={(event) => updateRule(rule.id, { valueTo: event.target.value })}
                  disabled={!needsSecondValue}
                  placeholder={needsSecondValue ? 'valor final' : 'somente intervalo'}
                  className={cn(
                    'rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 outline-none focus:border-blue-400',
                    !needsSecondValue && 'bg-slate-100 text-slate-400',
                  )}
                />

                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-500 hover:text-red-600"
                  aria-label={`Remover filtro ${index + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <DataPreviewTable rows={filteredRows} headerRowIndex={headerRowIndex} />
    </div>
  )
}
