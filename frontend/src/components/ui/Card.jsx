import { cn } from './utils'

const variants = {
  default: 'border-slate-200 bg-white shadow-sm',
  elevated: 'border-slate-200 bg-white shadow-md shadow-slate-200/60',
  subtle: 'border-slate-100 bg-slate-50/80 shadow-none',
}

export default function Card({ children, variant = 'default', className = '', as: Component = 'div', ...props }) {
  return (
    <Component
      className={cn('rounded-lg border', variants[variant] || variants.default, className)}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={cn('border-b border-slate-100 px-4 py-3', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={cn('p-4', className)}>{children}</div>
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={cn('border-t border-slate-100 px-4 py-3', className)}>
      {children}
    </div>
  )
}
