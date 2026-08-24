import { cn } from './utils'

export default function Tooltip({
  children,
  content,
  side = 'top',
  className = '',
  contentClassName = '',
}) {
  const position = {
    top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    bottom: 'left-1/2 top-full mt-2 -translate-x-1/2',
    left: 'right-full top-1/2 mr-2 -translate-y-1/2',
    right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  }

  return (
    <span className={cn('group relative inline-flex', className)} tabIndex={0}>
      {children}
      {content && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 hidden max-w-xs whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block group-focus:block',
            position[side] || position.top,
            contentClassName,
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
