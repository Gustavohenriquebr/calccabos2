import { cn } from './utils'

export default function Textarea({
  label,
  helperText,
  errorText,
  className = '',
  textareaClassName = '',
  id,
  rows = 4,
  ...props
}) {
  const fieldId = id || props.name

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        className={cn(
          'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-2',
          errorText
            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-primary-500 focus:ring-primary-100',
          textareaClassName,
        )}
        {...props}
      />
      {errorText ? (
        <p className="text-xs text-red-600">{errorText}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  )
}
