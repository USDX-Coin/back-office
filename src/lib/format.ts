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

// Generic middle-truncation for a hex string (address / tx hash):
// `0x1234…abcd`. Returns the value unchanged when it is already short enough.
// USDX-27: used by <TruncatedHash> for the responsive (mobile vs desktop)
// address/hash display.
export function truncateMiddle(value: string, head: number, tail: number): string {
  if (!value || value.length <= head + tail) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

// Truncate an 0x hash for display: `0x3d84b05e…d4587f`. Returns the hash
// unchanged when it's already short enough.
export function shortHash(hash: string, head = 10, tail = 6): string {
  return truncateMiddle(hash, head, tail)
}

// USDX-84 / USDX-87: short form of a request UUID for compact display in
// banners + the Manual Sync list. AC expects
// `019e1aa8-9c7c-7fcd-6abc-deadbeef0001` → `019e1aa8…f0001` (first UUID
// segment + last 5 chars). Delegates to truncateMiddle.
export function shortRequestId(id: string): string {
  return truncateMiddle(id, 8, 5)
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

// ─── Rekening BNI (USDX-631, sot/bni-integration.md § 16.4) ─────────────────

// A bank timestamp is a digit string in WIB with NO zone marker:
// `yyyyMMddHHmmss` (statement `postDate`), `yyyyMMddHHmm` (InquiryBalance
// `date`) or `yyyyMMdd` (statement `fromPostingDate` / `toPostingDate`). It is
// re-punctuated as-is — never parsed through `Date`, which would shift it into
// the browser's zone. Anything else (null, `MALFORMED`, stray spaces the
// service could not repair) renders as "—", never `Invalid Date`.
const BNI_STAMP = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?$/

export function formatBniPostDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const m = BNI_STAMP.exec(raw)
  if (!m) return '—'
  const [, y, mo, d, h, mi, s] = m
  const date = `${y}-${mo}-${d}`
  if (!h || !mi) return date
  return s ? `${date} ${h}:${mi}:${s}` : `${date} ${h}:${mi}`
}

// Bank nominal (string decimal, no sign) in the account's own currency:
// `IDR` → `Rp 1.234,00`, `USD` → `$1,234.00`; any other code falls back to a
// plain number followed by the code so nothing is silently mislabelled.
// Null / unparsable (`MALFORMED`) → "—".
export function formatBankAmount(
  amount: string | null | undefined,
  currency: string | null | undefined
): string {
  if (amount == null || amount === '') return '—'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  if (currency === 'IDR') return formatIdrAmount(n)
  if (currency === 'USD') return formatAmount(n)
  const plain = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  return currency ? `${plain} ${currency}` : plain
}

// Our own pull time (`pulledAt`, UTC ISO 8601 from the backend) rendered in
// WIB regardless of where the operator sits — the bank stamps next to it are
// WIB too, so the two must not disagree by the operator's zone.
const WIB_DATETIME_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/**
 * Jam dinding WIB saja: `HH:MM WIB` (USDX-639).
 *
 * Dipakai banner mode uji, yang harus menjawab satu pertanyaan dalam satu
 * kalimat — "sampai jam berapa ini menyala" — dan jendelanya tidak pernah
 * lebih dari 24 jam, jadi tanggalnya hanya menambah kata tanpa menambah
 * jawaban. Kartu Mode Mint tetap memakai `formatWibDateTime` yang lengkap.
 */
export function formatWibClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    WIB_DATETIME_FMT.formatToParts(date).find((p) => p.type === type)?.value ?? ''
  const hour = part('hour') === '24' ? '00' : part('hour')
  return `${hour}:${part('minute')} WIB`
}

export function formatWibDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    WIB_DATETIME_FMT.formatToParts(date).find((p) => p.type === type)?.value ?? ''
  const hour = part('hour') === '24' ? '00' : part('hour')
  return `${part('year')}-${part('month')}-${part('day')} ${hour}:${part('minute')}:${part('second')} WIB`
}
