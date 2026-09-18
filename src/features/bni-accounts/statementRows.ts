import type { BniStatementRow, BniStatementRowSource } from '@/lib/types'

// USDX-631 / USDX-692 — sot/bni-integration.md § 16.4 "Tabel": order by
// `postDate` descending, STABLE (original index breaks ties — `journalNo`
// repeats within a day), rows whose date is MALFORMED (null) sink to the bottom. The backend
// already sends this order; sorting again here costs nothing and guarantees
// the CSV and the table agree even if a future backend forgets.

export interface IndexedStatementRow {
  row: BniStatementRow
  /** Position in the backend response — the tie-breaker. */
  index: number
}

export function sortStatementRows(rows: readonly BniStatementRow[]): IndexedStatementRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const da = a.row.postDate
      const db = b.row.postDate
      if (da === null && db === null) return a.index - b.index
      if (da === null) return 1
      if (db === null) return -1
      if (da !== db) return da > db ? -1 : 1
      return a.index - b.index
    })
}

/**
 * `statement_entries.id` (yaml § BniStatementRow, D24) — stable across pulls, so
 * a refetch after "Segarkan dari bank" keeps every already-shown row mounted
 * instead of re-keying the page by position.
 */
export function statementRowKey({ row }: IndexedStatementRow): string {
  return row.id
}

const STATEMENT_SOURCE_LABEL: Record<BniStatementRowSource, string> = {
  BANK: 'BANK',
  UPLOAD: 'UNGGAHAN',
}

/**
 * § 16.8.8 kolom "Sumber". The enum is OPEN (yaml § BniStatementRowSource): a
 * value this build does not know is shown as-is, never blanked or guessed —
 * the one label map serves the table and the CSV.
 */
export function statementSourceLabel(source: string | null | undefined): string {
  if (!source) return ''
  // Own keys only: a plain index would resolve `"toString"` to a function.
  return Object.hasOwn(STATEMENT_SOURCE_LABEL, source)
    ? STATEMENT_SOURCE_LABEL[source as BniStatementRowSource]
    : source
}

/** Client-side page slice for `DataTable` (`rowCount` = total, data = this page). */
export function pageOf<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}
