// Pure helpers for the Transparency feature (/api/v1/transparency/*), built
// against catatan/KONTRAK-API-TRANSPARANSI.md.
//
// Two things in here exist because getting them wrong is expensive:
//
// 1. MONEY IS NEVER A FLOAT. The contract (§ 0) types every amount as a decimal
//    string over a numeric(30,2) column. 30 digits does not fit in a JS number,
//    and `0.1 + 0.2` does not equal `0.3`. Everything below works on integer
//    cents held in BigInt, so a reserve figure is exact no matter its size.
//
// 2. "TODAY" IS A WIB DAY, NOT A UTC ONE. The backend rejects a future
//    `occurredAt` using WIB (§ 3). Between 00:00 and 07:00 WIB the UTC date is
//    still yesterday, so a client that validated against UTC — or against the
//    operator's own timezone — would disagree with the server about what today
//    is and reject (or wave through) the wrong dates.

import type { AttestationReport } from './types'

// ─── Decimal money (integer cents in BigInt) ────────────────────────────────

/** Contract column is numeric(30,2): at most 2 decimal places, sign allowed. */
const DECIMAL_2DP_RE = /^-?\d+(\.\d{1,2})?$/

/**
 * Parses a contract decimal string into integer cents.
 * Returns `null` for anything that is not a valid 2-decimal number, so callers
 * must decide what to render — we never coerce an unparseable figure to 0.
 */
export function parseAmountToCents(raw: string): bigint | null {
  const value = raw.trim()
  if (!DECIMAL_2DP_RE.test(value)) return null
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [whole = '0', fraction = ''] = unsigned.split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return negative ? -cents : cents
}

/** Integer cents → contract decimal string (`-1234` → `"-12.34"`). */
export function centsToAmount(cents: bigint): string {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  const whole = abs / 100n
  const fraction = (abs % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/**
 * Exact `a + b` on two contract decimal strings. Returns `null` when either
 * side is unparseable — the confirmation dialog uses that to say "unavailable"
 * rather than show a made-up projected balance.
 */
export function addAmounts(a: string, b: string): string | null {
  const left = parseAmountToCents(a)
  const right = parseAmountToCents(b)
  if (left === null || right === null) return null
  return centsToAmount(left + right)
}

/** `"1250000.4"` → `"1,250,000.40"`. Grouping is done on the string, never via Number. */
export function formatAmountDecimal(raw: string): string {
  const cents = parseAmountToCents(raw)
  if (cents === null) return raw
  const text = centsToAmount(cents)
  const negative = text.startsWith('-')
  const [whole = '0', fraction = '00'] = (negative ? text.slice(1) : text).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}.${fraction}`
}

/**
 * Display form of a ledger amount with its currency, e.g. `"100,667.41 USD"`.
 * An unparseable amount is shown verbatim next to the currency instead of being
 * silently turned into a number that is not what the backend sent.
 */
export function formatLedgerAmount(amount: string, currency: string): string {
  return `${formatAmountDecimal(amount)} ${currency}`
}

/** True when the entry reduces the reserve — drives the negative-amount styling. */
export function isNegativeAmount(raw: string): boolean {
  const cents = parseAmountToCents(raw)
  return cents !== null && cents < 0n
}

// ─── WIB calendar day ───────────────────────────────────────────────────────

/** Western Indonesian Time is a fixed UTC+7 — no DST to account for. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

/**
 * Today's date in WIB as `YYYY-MM-DD` — the same "today" the backend computes
 * with `src/common/wib-day.util.ts` when it decides whether `occurredAt` is in
 * the future.
 */
export function wibToday(now: Date = new Date()): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * True when `occurredAt` (YYYY-MM-DD) is after today in WIB.
 * Zero-padded ISO dates sort lexicographically, so a string compare is exact
 * and avoids re-introducing a timezone through `new Date()`.
 */
export function isFutureWibDate(occurredAt: string, now: Date = new Date()): boolean {
  return occurredAt.trim() > wibToday(now)
}

// ─── Attestation reports ────────────────────────────────────────────────────

/**
 * A report is active until it is revoked. `GET /attestations` returns revoked
 * rows too, on purpose, so the audit trail is complete — which means the back
 * office is the one responsible for keeping them out of the active list. Left
 * unfiltered, a report that was pulled for being wrong keeps looking current.
 */
export function isActiveAttestation(report: AttestationReport): boolean {
  return report.revokedAt === null || report.revokedAt === undefined
}

/** Active reports only, newest reporting period first. */
export function activeAttestations(
  reports: readonly AttestationReport[]
): AttestationReport[] {
  return reports
    .filter(isActiveAttestation)
    .sort(
      (a, b) =>
        b.period.localeCompare(a.period) ||
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
    )
}

/**
 * Splits a `YYYY-MM` period into month and year. Returns `null` for anything
 * that is not a valid period — the caller must not invent a fallback, because a
 * wrong month/year mislabels a published document.
 */
export function getPeriodParts(period: string): { month: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return {
    month: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(year, month - 1, 1)
    ),
    year: String(year),
  }
}

/** "2026-07" → "July 2026"; returns the raw value when it is not a period. */
export function formatPeriod(period: string): string {
  const parts = getPeriodParts(period)
  if (!parts) return period
  return `${parts.month} ${parts.year}`
}

/** `"2026-07-23"` → `"23 Jul 2026"` without dragging the value through a Date. */
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function formatOccurredAt(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!match) return date
  const month = Number(match[2])
  if (month < 1 || month > 12) return date
  return `${Number(match[3])} ${MONTH_ABBR[month - 1]} ${match[1]}`
}
