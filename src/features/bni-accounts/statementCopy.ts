import { formatBankAmount, formatBniPostDate, formatIsoDayDmy, formatWibDayMinute } from '@/lib/format'
import type { BniStatementGap, BniStatementRefresh } from '@/lib/types'

// USDX-692 — sot/bni-integration.md § 16.8.8. Since D24 the statement is read
// from the USDX copy, so the screen owes the operator three honest answers the
// bank-live version never needed: until WHEN the copy was recorded, since WHEN
// history exists at all (K18 — no backfill), and WHERE the balance chain proves
// a mutation was never recorded (K15). Pure text builders; the panel renders.

const PORTAL = 'portal BNIDirect'

/** Header hasil: "direkam s/d DD/MM/YYYY HH:mm WIB" — null → "belum pernah direkam". */
export function recordedThroughLabel(recordedThrough: string | null | undefined): string {
  const stamp = formatWibDayMinute(recordedThrough)
  return stamp ? `direkam s/d ${stamp}` : 'belum pernah direkam'
}

export type HistoryNotice =
  /** The whole applied range lies inside the recorded history — say nothing. */
  | { kind: 'none' }
  /** Part of the range predates the history: banner ABOVE a table that may hold rows. */
  | { kind: 'partial'; text: string }
  /** Nothing of the range can be in the copy: the banner REPLACES the `empty` state. */
  | { kind: 'entire'; text: string }

/**
 * `startDate < historyAvailableSince` (or no history at all) → the "Riwayat
 * tersedia sejak" banner. Both sides are WIB calendar days `YYYY-MM-DD`, so
 * plain string comparison IS calendar comparison — no `Date`, no zone.
 *
 * A `historyAvailableSince` that is null OR not a calendar day is read as "never
 * recorded": the sentence then carries no date at all rather than a broken one.
 */
export function historyNotice(
  applied: { startDate: string; endDate: string },
  historyAvailableSince: string | null | undefined
): HistoryNotice {
  const since = formatIsoDayDmy(historyAvailableSince)
  if (!historyAvailableSince || !since) {
    return {
      kind: 'entire',
      text: `Riwayat belum tersedia — rekening ini belum pernah direkam. Untuk mutasinya lihat ${PORTAL}.`,
    }
  }
  if (applied.startDate >= historyAvailableSince) return { kind: 'none' }
  const text = `Riwayat tersedia sejak ${since} — untuk tanggal sebelumnya lihat ${PORTAL}.`
  return applied.endDate < historyAvailableSince ? { kind: 'entire', text } : { kind: 'partial', text }
}

function gapPoint(stamp: string | null | undefined): string | null {
  const formatted = formatBniPostDate(stamp)
  return formatted === '—' ? null : formatted
}

// `difference` is a SIGNED decimal string. The sign is information (net
// unrecorded credit vs debit), so it is spelled out in front of the currency
// instead of being left to Intl ("Rp -10.011,00").
function signedAmount(difference: string, currency: string | null | undefined): string | null {
  const trimmed = difference.trim()
  const negative = trimmed.startsWith('-')
  const magnitude = formatBankAmount(trimmed.replace(/^[+-]/, ''), currency)
  if (magnitude === '—') return null
  return `${negative ? '−' : '+'}${magnitude}`
}

/**
 * One warning per `gaps[]` entry: "Ada mutasi yang tidak terekam antara {afterAt}
 * dan {beforeAt} — selisih {difference}. Cek rekening koran di portal BNIDirect."
 * `afterAt` null = the bracketing point lies outside the history; `difference`
 * null (a MALFORMED value broke the chain) → "nominal tidak dapat dihitung".
 */
export function gapNoticeText(gap: BniStatementGap, currency: string | null | undefined): string {
  const after = gapPoint(gap.afterAt) ?? 'awal riwayat'
  const before = gapPoint(gap.beforeAt) ?? 'waktu yang tidak terbaca'
  const amount = gap.difference == null ? null : signedAmount(gap.difference, currency)
  const difference = amount ? `selisih ${amount}` : 'selisih nominal tidak dapat dihitung'
  return `Ada mutasi yang tidak terekam antara ${after} dan ${before} — ${difference}. Cek rekening koran di ${PORTAL}.`
}

/** Toast after "Segarkan dari bank": "N mutasi baru terekam" / "Tidak ada mutasi baru". */
export function refreshResultText(result: Pick<BniStatementRefresh, 'newEntries'>): string {
  return result.newEntries > 0 ? `${result.newEntries} mutasi baru terekam` : 'Tidak ada mutasi baru'
}
