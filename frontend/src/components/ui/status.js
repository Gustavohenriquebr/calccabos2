export function normalizeStatus(status, fallback = 'ALERTA') {
  const text = String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()

  if (!text) return fallback
  if (text === 'OK') return 'OK'
  if (text.includes('ALERTA') || text.includes('WARNING')) return 'ALERTA'
  if (text.includes('CR') || text.includes('ERRO') || text.includes('ERROR')) return 'CRITICO'
  return fallback
}

export function displayStatus(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'CRITICO') return 'CRÍTICO'
  return normalized
}

export function statusClass(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'OK') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'CRITICO') {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export function statusDotClass(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'OK') return 'bg-emerald-500'
  if (normalized === 'CRITICO') return 'bg-red-500'
  return 'bg-amber-500'
}
