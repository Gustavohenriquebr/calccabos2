import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import api from '../../../services/api'
import SheetSelector from './SheetSelector'
import DataPreviewTable from './DataPreviewTable'
import ImportFilterBuilder from './ImportFilterBuilder'
import ColumnMapper from './ColumnMapper'
import ImportValidationSummary from './ImportValidationSummary'
import ImportReviewTable from './ImportReviewTable'
import {
  IMPORT_FIELDS,
  REQUIRED_IMPORT_FIELDS,
  parseExcelFile,
  cleanRows,
  applyImportFilters,
  autoMapColumns,
  validateImportedRows,
  validateCircuitoForImport,
} from '../../../utils/excelImport'

const STEP_LABELS = [
  'Upload',
  'Aba e Cabecalho',
  'Pre-visualizacao',
  'Filtros',
  'Mapeamento',
  'Validacao',
]

const IMPORT_BATCH_SIZE = 50
const IMPORT_TIMEOUT_MS = 180000
const CONFIRM_THROTTLE_MS = 1200

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function getApiError(error, fallback) {
  const status = Number(error?.response?.status || 0)
  if (status === 429) {
    return 'Motor de cálculo recebeu muitas requisições. Aguarde alguns segundos e tente novamente.'
  }
  if ([502, 503, 504].includes(status)) {
    return 'Motor de cálculo temporariamente indisponível.'
  }
  if (error?.code === 'ECONNABORTED') {
    return 'A importacao demorou mais que o esperado (timeout). Tente novamente com menos linhas por arquivo.'
  }
  const data = error?.response?.data || {}
  if (data.code === 'USAGE_LIMIT_EXCEEDED' || data.code === 'FEATURE_NOT_AVAILABLE') {
    return `${data.message || fallback} Alternativa: reduza a quantidade de linhas ou solicite o plano ${data.recommendedPlan || 'pro'}.`
  }
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg || JSON.stringify(item)).join(' | ')
  if (detail?.mensagem) return detail.mensagem
  if (detail?.upstream?.reason) return String(detail.upstream.reason)
  if (error?.response?.data?.upstream?.reason) return String(error.response.data.upstream.reason)
  if (typeof error?.response?.data?.error === 'string') return error.response.data.error
  return fallback
}

function splitIntoBatches(items, size) {
  const safeItems = Array.isArray(items) ? items : []
  if (!safeItems.length) return []
  const batches = []
  for (let index = 0; index < safeItems.length; index += size) {
    batches.push(safeItems.slice(index, index + size))
  }
  return batches
}

function safeHeaderLabel(value, index) {
  const text = String(value ?? '').trim()
  return text || `Coluna ${index + 1}`
}

export default function ExcelImportWizard({ onClose, onImportacaoConcluida, projetoId }) {
  const inputRef = useRef(null)
  const [step, setStep] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [error, setError] = useState('')
  const [importReport, setImportReport] = useState(null)
  const [file, setFile] = useState(null)
  const [workbook, setWorkbook] = useState(null)
  const [selectedSheetName, setSelectedSheetName] = useState('')
  const [headerRowIndex, setHeaderRowIndex] = useState(0)
  const [cleanOptions, setCleanOptions] = useState({
    removeEmptyRows: true,
    removeEmptyColumns: true,
    trimValues: true,
  })
  const [mapping, setMapping] = useState({})
  const [confidence, setConfidence] = useState({})
  const [filterRules, setFilterRules] = useState([])
  const [reviewRows, setReviewRows] = useState([])
  const [replaceExisting, setReplaceExisting] = useState(false)
  const confirmLockRef = useRef(false)
  const lastConfirmAtRef = useRef(0)

  const selectedSheet = useMemo(
    () => workbook?.sheets?.find((sheet) => sheet.name === selectedSheetName) || null,
    [workbook, selectedSheetName],
  )

  const rawRows = selectedSheet?.rows || []
  const cleanedRows = useMemo(
    () => cleanRows(rawRows, { headerRowIndex, ...cleanOptions }),
    [rawRows, headerRowIndex, cleanOptions],
  )

  const effectiveHeaderRowIndex = useMemo(() => {
    if (!cleanedRows.length) return 0
    return Math.min(headerRowIndex, cleanedRows.length - 1)
  }, [cleanedRows, headerRowIndex])

  const headers = useMemo(
    () => (cleanedRows[effectiveHeaderRowIndex] || []).map((cell, index) => safeHeaderLabel(cell, index)),
    [cleanedRows, effectiveHeaderRowIndex],
  )

  const filteredData = useMemo(
    () => applyImportFilters({
      rows: cleanedRows,
      headerRowIndex: effectiveHeaderRowIndex,
      headers,
      rules: filterRules,
    }),
    [cleanedRows, effectiveHeaderRowIndex, headers.join('|'), filterRules],
  )

  useEffect(() => {
    if (!headers.length) return
    const auto = autoMapColumns(headers)
    setConfidence(auto.confidence)
    setMapping((previous) => {
      const next = {}
      IMPORT_FIELDS.forEach((field) => {
        const previousValue = previous?.[field.key]
        next[field.key] = headers.includes(previousValue) ? previousValue : (auto.mapping[field.key] || '')
      })
      return next
    })
  }, [headers.join('|')])

  const validation = useMemo(
    () => validateImportedRows({ rows: filteredData.rows, headerRowIndex: effectiveHeaderRowIndex, mapping }),
    [filteredData.rows, effectiveHeaderRowIndex, mapping],
  )

  const requiredMapped = REQUIRED_IMPORT_FIELDS.every((fieldKey) => Boolean(mapping[fieldKey]))

  const reviewStats = useMemo(() => {
    const activeRows = reviewRows.filter((row) => !row.removed)
    return {
      total: reviewRows.length,
      valid: activeRows.filter((row) => row.valido).length,
      invalid: activeRows.filter((row) => !row.valido).length,
      removed: reviewRows.filter((row) => row.removed).length,
    }
  }, [reviewRows])

  const reviewValidRows = useMemo(
    () => reviewRows.filter((row) => !row.removed && row.valido).map((row) => row.circuito),
    [reviewRows],
  )

  const resetError = () => setError('')

  function buildReviewRows() {
    return (validation.rows || []).map((row, index) => ({
      id: `${row.linha}-${index}`,
      linha: row.linha,
      circuito: { ...(row.circuito || {}) },
      valido: row.valido,
      erros: row.erros || [],
      removed: false,
    }))
  }

  async function handleFileSelection(nextFile) {
    if (!nextFile) return
    setLoadingFile(true)
    setError('')
    setImportReport(null)
    try {
      const parsed = await parseExcelFile(nextFile)
      setFile(nextFile)
      setWorkbook(parsed)
      setSelectedSheetName(parsed.sheets[0]?.name || '')
      setHeaderRowIndex(0)
      setCleanOptions({
        removeEmptyRows: true,
        removeEmptyColumns: true,
        trimValues: true,
      })
      setMapping({})
      setConfidence({})
      setFilterRules([])
      setReviewRows([])
      setReplaceExisting(false)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Nao foi possivel ler o arquivo selecionado.')
      setFile(null)
      setWorkbook(null)
      setSelectedSheetName('')
    } finally {
      setLoadingFile(false)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    handleFileSelection(event.dataTransfer.files?.[0])
  }

  function handleAutoMap() {
    const auto = autoMapColumns(headers)
    setMapping((previous) => {
      const next = { ...previous }
      IMPORT_FIELDS.forEach((field) => {
        next[field.key] = auto.mapping[field.key] || ''
      })
      return next
    })
    setConfidence(auto.confidence)
  }

  function goBack() {
    setError('')
    setStep((current) => Math.max(1, current - 1))
  }

  function goNext() {
    setError('')
    if (step === 1 && !workbook) {
      setError('Selecione um arquivo para continuar.')
      return
    }
    if (step === 5 && !requiredMapped) {
      setError('Mapeie todos os campos obrigatorios antes de validar.')
      return
    }
    if (step === 5) {
      setReviewRows(buildReviewRows())
    }
    setStep((current) => Math.min(6, current + 1))
  }

  function editReviewRow(rowId, field, value) {
    setReviewRows((current) => current.map((row) => {
      if (row.id !== rowId) return row
      const validated = validateCircuitoForImport({ ...row.circuito, [field]: value })
      return {
        ...row,
        circuito: validated.circuito,
        valido: validated.valido,
        erros: validated.errors,
      }
    }))
  }

  function removeReviewRow(rowId) {
    setReviewRows((current) => current.map((row) => (row.id === rowId ? { ...row, removed: true } : row)))
  }

  function restoreReviewRow(rowId) {
    setReviewRows((current) => current.map((row) => (row.id === rowId ? { ...row, removed: false } : row)))
  }

  function removeAllReviewRows() {
    setReviewRows((current) => current.map((row) => ({ ...row, removed: true })))
  }

  function restoreAllReviewRows() {
    setReviewRows((current) => current.map((row) => ({ ...row, removed: false })))
  }

  async function confirmImport() {
    if (confirmLockRef.current) return
    const now = Date.now()
    if (now - lastConfirmAtRef.current < CONFIRM_THROTTLE_MS) return
    lastConfirmAtRef.current = now
    confirmLockRef.current = true

    if (validation.mappingErrors.length > 0) {
      setError(validation.mappingErrors[0])
      confirmLockRef.current = false
      return
    }
    if (reviewValidRows.length === 0) {
      setError('Nenhuma linha valida para importar. Revise, edite ou restaure linhas antes de continuar.')
      confirmLockRef.current = false
      return
    }
    if (replaceExisting) {
      const confirmed = window.confirm('Excluir todos os circuitos atuais deste projeto antes de importar as linhas validas?')
      if (!confirmed) {
        confirmLockRef.current = false
        return
      }
    }

    setImporting(true)
    setImportProgress('Preparando importacao...')
    setError('')
    setImportReport(null)
    try {
      const importRequestId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `imp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      let removidos = 0
      if (replaceExisting) {
        setImportProgress('Removendo circuitos existentes...')
        const { data } = await api.delete(`/circuitos/projeto/${projetoId}`, { timeout: IMPORT_TIMEOUT_MS })
        removidos = Number(data?.removidos || 0)
      }

      const batches = splitIntoBatches(reviewValidRows, IMPORT_BATCH_SIZE)
      let totalCriados = 0
      const collectedErrors = []
      const collectedWarnings = []

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const linhasLote = batches[batchIndex]
        setImportProgress(`Validando lote ${batchIndex + 1} de ${batches.length}...`)
        const { data } = await api.post(
          '/circuitos/importar-circuitos/confirmar',
          {
            projeto_id: projetoId,
            linhas: linhasLote,
            mapeamento_usuario: mapping,
          },
          {
            timeout: IMPORT_TIMEOUT_MS,
            headers: {
              'X-Import-Request-Id': importRequestId,
              'X-Import-Batch-Index': String(batchIndex + 1),
              'X-Import-Batch-Total': String(batches.length),
            },
          },
        )

        totalCriados += Number(data?.criados || 0)
        if (Array.isArray(data?.erros) && data.erros.length > 0) {
          data.erros.forEach((item) => {
            collectedErrors.push({
              lote: batchIndex + 1,
              linha: item?.linha ?? '-',
              erros: Array.isArray(item?.erros) ? item.erros : ['Erro nao especificado'],
            })
          })
        }
        if (Array.isArray(data?.avisos) && data.avisos.length > 0) {
          data.avisos.forEach((item) => {
            collectedWarnings.push({
              lote: batchIndex + 1,
              linha: item?.linha ?? '-',
              aviso: item?.aviso || 'Aviso de importacao',
              detalhe: item?.detalhe || '',
            })
          })
        }
      }

      setImportReport({
        criados: totalCriados,
        removidos,
        erros: collectedErrors,
        avisos: collectedWarnings,
      })
      setImportProgress('Importacao concluida.')

      if (totalCriados > 0) {
        onImportacaoConcluida?.()
      }

      if (collectedErrors.length === 0 && collectedWarnings.length === 0 && totalCriados > 0) {
        onClose?.()
        return
      }

      if (collectedErrors.length > 0) {
        setError(
          `Importacao parcial: ${totalCriados} linha(s) importada(s), ${collectedErrors.length} erro(s).`,
        )
      } else if (collectedWarnings.length > 0) {
        setError(
          `Importacao concluida com aviso: ${totalCriados} linha(s) importada(s), mas o calculo ficou pendente em ${collectedWarnings.length} linha(s).`,
        )
      } else if (totalCriados === 0) {
        setError('Nenhuma linha foi importada. Revise os dados e tente novamente.')
      }
    } catch (err) {
      const detail = getApiError(err, 'Erro ao importar as linhas validas.')
      const status = err?.response?.status ? ` (HTTP ${err.response.status})` : ''
      setError(`${detail}${status}`)
      setImportProgress('')
    } finally {
      setImporting(false)
      confirmLockRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Importar Circuitos (Excel)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fluxo: upload, aba, cabecalho, pre-visualizacao, filtros, mapeamento e validacao.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, index) => {
              const stepNumber = index + 1
              return (
                <div key={label} className="flex items-center flex-1 min-w-0">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      step > stepNumber
                        ? 'bg-emerald-500 text-white'
                        : step === stepNumber
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {step > stepNumber ? <CheckCircle size={12} /> : stepNumber}
                  </div>
                  <span className={cn('ml-2 text-[11px] truncate', step === stepNumber ? 'text-blue-600' : 'text-slate-400')}>
                    {label}
                  </span>
                  {stepNumber < STEP_LABELS.length && (
                    <div className={cn('flex-1 h-px mx-2', step > stepNumber ? 'bg-emerald-300' : 'bg-slate-200')} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {step === 1 && (
            <div className="pt-2 space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors select-none',
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                {loadingFile
                  ? <Loader2 size={34} className="text-blue-500 animate-spin" />
                  : <FileSpreadsheet size={34} className={dragging ? 'text-blue-500' : 'text-slate-300'} />}
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">
                    {loadingFile ? 'Lendo arquivo...' : 'Arraste o arquivo .xlsx, .xls ou .csv'}
                  </p>
                  {!loadingFile && <p className="text-xs text-slate-400 mt-1">ou clique para selecionar</p>}
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files?.[0])}
              />
              {file && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Arquivo selecionado: <span className="font-semibold">{file.name}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedSheet && (
            <div className="space-y-4 pt-2">
              <SheetSelector
                sheets={workbook?.sheets || []}
                selectedSheetName={selectedSheetName}
                onSelectSheet={(value) => {
                  setSelectedSheetName(value)
                  setHeaderRowIndex(0)
                  setFilterRules([])
                  setReviewRows([])
                  resetError()
                }}
                headerRowIndex={headerRowIndex}
                onHeaderRowChange={(value) => {
                  setHeaderRowIndex(value)
                  setFilterRules([])
                  setReviewRows([])
                  resetError()
                }}
                options={cleanOptions}
                onOptionsChange={(nextOptions) => {
                  setCleanOptions(nextOptions)
                  setFilterRules([])
                  setReviewRows([])
                  resetError()
                }}
                selectedSheetRows={selectedSheet.rows}
              />
              <DataPreviewTable rows={selectedSheet.rows} headerRowIndex={headerRowIndex} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Aba selecionada: <span className="font-semibold">{selectedSheetName}</span> | Cabecalho: linha{' '}
                <span className="font-semibold">{effectiveHeaderRowIndex + 1}</span>
              </div>
              <DataPreviewTable rows={cleanedRows} headerRowIndex={effectiveHeaderRowIndex} />
            </div>
          )}

          {step === 4 && (
            <div className="pt-2">
              <ImportFilterBuilder
                headers={headers}
                rules={filterRules}
                onRulesChange={(nextRules) => {
                  setFilterRules(nextRules)
                  setReviewRows([])
                  resetError()
                }}
                filterStats={filteredData.stats}
                filteredRows={filteredData.rows}
                headerRowIndex={effectiveHeaderRowIndex}
              />
            </div>
          )}

          {step === 5 && (
            <div className="pt-2">
              <ColumnMapper
                fields={IMPORT_FIELDS}
                headers={headers}
                mapping={mapping}
                confidence={confidence}
                onAutoMap={handleAutoMap}
                onChangeMapping={(key, value) => {
                  setMapping((current) => ({ ...current, [key]: value }))
                }}
              />
            </div>
          )}

          {step === 6 && (
            <div className="pt-2 space-y-4">
              <ImportValidationSummary
                validation={{
                  ...validation,
                  summary: {
                    total: reviewStats.total,
                    validas: reviewStats.valid,
                    invalidas: reviewStats.invalid,
                    ignoradasPorFiltro: filteredData.stats.ignored,
                  },
                  invalidRows: reviewRows.filter((row) => !row.removed && !row.valido),
                  filterStats: filteredData.stats,
                }}
              />
              <ImportReviewTable
                rows={reviewRows}
                stats={reviewStats}
                replaceExisting={replaceExisting}
                onReplaceExistingChange={setReplaceExisting}
                onEditRow={editReviewRow}
                onRemoveRow={removeReviewRow}
                onRestoreRow={restoreReviewRow}
                onRemoveAllRows={removeAllReviewRows}
                onRestoreAllRows={restoreAllReviewRows}
              />
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {importing && importProgress && (
            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {importProgress}
            </div>
          )}

          {importReport && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="font-medium">
                Resultado: {importReport.criados} linha(s) importada(s)
              </p>
              {importReport.removidos > 0 && (
                <p className="mt-1 text-slate-600">
                  {importReport.removidos} circuito(s) antigo(s) removido(s) antes da importacao.
                </p>
              )}
              {(importReport.avisos || []).length > 0 && (
                <div className="mt-1.5 text-amber-700">
                  {(importReport.avisos || []).slice(0, 8).map((item, idx) => (
                    <p key={`import-warning-${idx}`}>
                      Lote {item.lote}, linha {item.linha}: {item.aviso} {item.detalhe ? `(${item.detalhe})` : ''}
                    </p>
                  ))}
                  {importReport.avisos.length > 8 && (
                    <p>... e mais {importReport.avisos.length - 8} aviso(s).</p>
                  )}
                </div>
              )}
              {importReport.erros.length > 0 && (
                <div className="mt-1.5 text-red-600">
                  {importReport.erros.slice(0, 8).map((item, idx) => (
                    <p key={`import-error-${idx}`}>
                      Lote {item.lote}, linha {item.linha}: {item.erros.join(' | ')}
                    </p>
                  ))}
                  {importReport.erros.length > 8 && (
                    <p>... e mais {importReport.erros.length - 8} erro(s).</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/60">
          <div className="text-xs text-slate-500">
            {file ? `Arquivo: ${file.name}` : 'Nenhum arquivo selecionado'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded transition-colors"
              disabled={importing}
            >
              Cancelar
            </button>
            {step > 1 && (
              <button
                onClick={goBack}
                disabled={importing}
                className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded font-medium disabled:opacity-40"
              >
                <ChevronLeft size={13} />
                Voltar
              </button>
            )}
            {step < 6 && (
              <button
                onClick={goNext}
                disabled={loadingFile || importing || (step === 1 && !workbook)}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium disabled:opacity-40"
              >
                <ChevronRight size={13} />
                Proximo
              </button>
            )}
            {step === 6 && (
              <button
                onClick={confirmImport}
                disabled={importing || reviewValidRows.length === 0 || validation.mappingErrors.length > 0}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded font-medium disabled:opacity-40"
              >
                {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {importing ? 'Importando...' : `Importar ${reviewStats.valid || 0} linhas validas`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
