export default function CompletionScore({ value }) {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null
  const width = safeValue === null ? 0 : safeValue

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">Completude do projeto</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {safeValue === null ? 'N/D' : `${safeValue}%`}
          </div>
        </div>
        <div className="text-xs text-slate-500">Confiança visual</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary-700 transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
