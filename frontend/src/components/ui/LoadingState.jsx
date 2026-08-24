import { cn } from './utils'

export default function LoadingState({ message = 'Carregando...', className = '' }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 rounded-lg border border-slate-100 bg-white p-6 text-sm text-slate-500', className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
      {message}
    </div>
  )
}
