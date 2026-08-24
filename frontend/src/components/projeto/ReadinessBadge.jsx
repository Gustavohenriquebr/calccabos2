import { StatusBadge } from '../ui'

export default function ReadinessBadge({ readiness }) {
  if (!readiness) return null
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      <StatusBadge status={readiness.status} showDot={false} />
      {readiness.label}
    </span>
  )
}
