import { displayStatus, statusClass, statusDotClass } from './status'
import { cn } from './utils'

export default function StatusBadge({ status = 'ALERTA', showDot = true, className = '' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
        statusClass(status),
        className,
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(status))} />}
      {displayStatus(status)}
    </span>
  )
}
