export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatShortDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString))
}

const SHORT_MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const SHORT_MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const then = new Date(dateString)
  const deltaMs = now.getTime() - then.getTime()
  if (deltaMs < 0) return 'just now'

  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const dayDelta = Math.floor((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000)

  // Same calendar day → hour-granular
  if (dayDelta === 0) {
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }
  if (dayDelta === 1) return 'yesterday'
  if (dayDelta < 7) return `${dayDelta}d ago`

  if (now.getFullYear() === then.getFullYear()) {
    return SHORT_MONTH_DAY.format(then)
  }
  return SHORT_MONTH_DAY_YEAR.format(then)
}
