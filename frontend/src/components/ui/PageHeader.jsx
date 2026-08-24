import StatusBadge from './StatusBadge'

export default function PageHeader({ title, subtitle, status, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950">{title}</h1>
          {status && <StatusBadge status={status} />}
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
