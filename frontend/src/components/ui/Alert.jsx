import { cn } from './utils'

const variants = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
}

export default function Alert({ title, children, variant = 'info', icon: Icon, className = '' }) {
  return (
    <div className={cn('rounded-lg border p-4 text-sm', variants[variant] || variants.info, className)}>
      <div className="flex gap-3">
        {Icon && <Icon size={18} className="mt-0.5 shrink-0" />}
        <div>
          {title && <div className="font-semibold">{title}</div>}
          {children && <div className={cn(title && 'mt-1')}>{children}</div>}
        </div>
      </div>
    </div>
  )
}
