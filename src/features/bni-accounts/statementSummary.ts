import type { BniStatementRow, BniStatementType, BniValueAnomaly } from '@/lib/types'

// USDX-631 — small pure helpers for the statement panel (§ 16.4 "Ringkasan").

export const STATEMENT_TYPE_LABEL: Record<BniStatementType, string> = {
  ALL: 'Semua',
  CREDIT: 'Masuk',
  DEBIT: 'Keluar',
}

export interface AnomalyCounts {
  malformed: number
  repaired: number
}

/** Rows with ≥1 MALFORMED value vs rows with only REPAIRED values. */
export function countAnomalyRows(rows: readonly BniStatementRow[]): AnomalyCounts {
  let malformed = 0
  let repaired = 0
  for (const row of rows) {
    const kinds = row.anomalies ?? []
    if (kinds.length === 0) continue
    if (kinds.some((a) => a.kind === 'MALFORMED')) malformed += 1
    else if (kinds.some((a) => a.kind === 'REPAIRED')) repaired += 1
  }
  return { malformed, repaired }
}

/**
 * The single anomaly line: "1 baris dengan nilai tidak terbaca · 2 baris dengan
 * nilai diperbaiki". Account-level `NO_ACCOUNT_DETAIL` (bank returned no account
 * entry at all — yaml § BniValueAnomaly) is appended so an empty result can be
 * told apart from "an entry with zero transactions".
 */
export function anomalyLine(
  counts: AnomalyCounts,
  accountAnomalies: readonly BniValueAnomaly[] | undefined = []
): string {
  const parts: string[] = []
  if (counts.malformed > 0) parts.push(`${counts.malformed} baris dengan nilai tidak terbaca`)
  if (counts.repaired > 0) parts.push(`${counts.repaired} baris dengan nilai diperbaiki`)
  if (parts.length === 0) parts.push('Tidak ada nilai yang diperbaiki atau tidak terbaca')
  if (accountAnomalies.some((a) => a.kind === 'NO_ACCOUNT_DETAIL')) {
    parts.push('bank tidak mengembalikan entri rekening untuk rentang ini')
  }
  return parts.join(' · ')
}

/** `yyyyMMdd` from the bank vs the `YYYY-MM-DD` we asked for. */
export function postingRangeDiffers(
  applied: { startDate: string; endDate: string },
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  if (!from || !to) return false
  const compact = (iso: string) => iso.replace(/-/g, '')
  return from !== compact(applied.startDate) || to !== compact(applied.endDate)
}
