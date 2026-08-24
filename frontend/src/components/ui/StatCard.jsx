import Card from './Card'
import StatusBadge from './StatusBadge'
import { cn } from './utils'

export default function StatCard({
  title,
  value,
  subtitle,
  status,
  icon: Icon,
  className = '',
}) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary-900">
            <Icon size={18} />
          </div>
        )}
      </div>
      {status && <div className="mt-3"><StatusBadge status={status} /></div>}
    </Card>
  )
}
