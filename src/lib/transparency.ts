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

// ─── Idempotency ────────────────────────────────────────────────────────────

/**
 * A fresh key for one attempt at filing a ledger entry (§ 3).
 *
 * Why this exists at all: `POST /ledger` is append-only and public. A gateway
 * timeout hides the response of a request that already wrote its row, the
 * operator presses the button again, and usdx.co.id reports twice the reserve
 * it holds. The key lets the backend recognise the second request as the same
 * attempt and hand back the row it already created.
 *
 * Callers must mint this ONCE per form-filling attempt and re-send the SAME
 * value on every retry — minting one per click would defeat the entire point.
 *
 * Random source is the platform CSPRNG. If neither entry point exists we throw
 * rather than fall back to `Math.random()`: a guessable or colliding key is
 * worse than a blocked submit, because a collision would silently swallow a
 * genuine second entry.
 */
export function newIdempotencyKey(): string {
  const webcrypto = globalThis.crypto
  if (typeof webcrypto?.randomUUID === 'function') {
    return webcrypto.randomUUID()
  }
  if (typeof webcrypto?.getRandomValues === 'function') {
    const bytes = webcrypto.getRandomValues(new Uint8Array(16))
    // RFC 4122 §4.4 — pin the version (4) and variant bits.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-')
  }
  throw new Error(
    'No cryptographic random source available to generate an idempotency key'
  )
}

// ─── Attestation reports ────────────────────────────────────────────────────

/** Every PDF starts with this signature (ISO 32000-1 § 7.5.2). */
const PDF_MAGIC = '%PDF-'

/**
 * Reads the first bytes of the picked file and reports whether they are a PDF
 * header.
 *
 * The name and the browser-reported MIME type are both attacker-chosen: renaming
 * `payload.exe` to `report.pdf` gives `{ name: 'report.pdf', type: '' }`, and an
 * empty `type` is exactly the case the extension fallback was written to
 * tolerate. The bytes are the only part of the claim the file cannot fake.
 *
 * Returns `null` when the content genuinely could not be read (no `arrayBuffer`,
 * revoked file handle) — the caller decides, and must not read that as a pass.
 */
export async function looksLikePdf(file: Blob): Promise<boolean | null> {
  try {
    if (typeof file.slice !== 'function' || typeof file.arrayBuffer !== 'function') {
      return null
    }
    const head = await file.slice(0, PDF_MAGIC.length).arrayBuffer()
    const text = String.fromCharCode(...new Uint8Array(head))
    return text === PDF_MAGIC
  } catch {
    return null
  }
}

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
