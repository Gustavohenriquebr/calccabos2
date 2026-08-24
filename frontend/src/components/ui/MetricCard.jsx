import Card from './Card'
import StatusBadge from './StatusBadge'
import { cn } from './utils'

export default function MetricCard({
  label,
  value,
  unit,
  description,
  status,
  icon: Icon,
  className = '',
}) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight text-slate-950">{value}</span>
            {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
          </div>
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
            <Icon size={18} />
          </div>
        )}
      </div>
      {status && <div className="mt-3"><StatusBadge status={status} /></div>}
    </Card>
  )
}
