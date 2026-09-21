import type { BniStatementRow, BniStatementType } from '@/lib/types'

// USDX-631 / USDX-692 — small pure helpers for the statement panel (§ 16.4
// "Ringkasan", amended by § 16.8.8: figures come from the USDX copy).

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
 * nilai diperbaiki". Row-level only: the account-level `NO_ACCOUNT_DETAIL` of
 * the direct-pull days is never sent since D24 (yaml § BniValueAnomaly).
 */
export function anomalyLine(counts: AnomalyCounts): string {
  const parts: string[] = []
  if (counts.malformed > 0) parts.push(`${counts.malformed} baris dengan nilai tidak terbaca`)
  if (counts.repaired > 0) parts.push(`${counts.repaired} baris dengan nilai diperbaiki`)
  if (parts.length === 0) parts.push('Tidak ada nilai yang diperbaiki atau tidak terbaca')
  return parts.join(' · ')
}
