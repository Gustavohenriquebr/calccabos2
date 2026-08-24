export function cn(...classes) {
  return classes
    .flatMap((item) => {
      if (!item) return []
      if (Array.isArray(item)) return item
      if (typeof item === 'object') {
        return Object.entries(item)
          .filter(([, active]) => Boolean(active))
          .map(([className]) => className)
      }
      return [item]
    })
    .filter(Boolean)
    .join(' ')
}
