export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// USDX-46 — preview helpers for the currency-aware amount input.
//
// sot/conventions.md § Decimals:
// - USDX uses 6 decimals (like USDC/USDT) — display up to 6.
// - IDR uses 2 decimals + locale format `Rp 16.250.000,00`.

const USDX_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
})

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatUsdxAmount(usdx: number): string {
  if (!Number.isFinite(usdx)) return '—'
  return `${USDX_FORMATTER.format(usdx)} USDX`
}

export function formatIdrAmount(idr: number): string {
  if (!Number.isFinite(idr)) return '—'
  return `Rp ${IDR_FORMATTER.format(idr)}`
}

// Truncate an 0x hash for display: `0x3d84b05e…d4587f`. Returns the hash
// unchanged when it's already short enough.
export function shortHash(hash: string, head = 10, tail = 6): string {
  if (hash.length <= head + tail) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

// USDX-84: short form of a request UUID for compact display in error banners.
// AC expects `019e1aa8-9c7c-7fcd-6abc-deadbeef0001` → `019e1aa8…f0001`
// (first 8 chars = leading UUID segment, last 5 chars). Returns the input
// unchanged when it's already short enough.
export function shortRequestId(id: string): string {
  const head = 8
  const tail = 5
  if (id.length <= head + tail) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
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

// Format a decimal rate string ("16250.00") as "16,250.00 IDR/USD".
// Falls back to the raw string when input cannot be parsed, so we never
// hide unexpected backend values behind a coercion artifact.
export function formatRate(rate: string): string {
  const n = Number(rate)
  if (!Number.isFinite(n)) return rate
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} IDR/USD`
}

// Format spread as a literal percentage. SoT example "0.5" means 0.5%
// (sot/phase-1.md § Rate Configuration: "spread_pct ... markup % di atas rate").
// See docs/notes/usdx-20-decisions.md for the literal-percent rationale.
export function formatSpreadPct(pct: string): string {
  const n = Number(pct)
  if (!Number.isFinite(n)) return `${pct}%`
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)}%`
}

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
