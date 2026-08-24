import Button from './Button'
import Card from './Card'
import { cn } from './utils'

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  className = '',
}) {
  return (
    <Card variant="subtle" className={cn('p-8 text-center', className)}>
      {Icon && (
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
          <Icon size={22} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </Card>
  )
}
