import type { BniStatementRow } from '@/lib/types'

// USDX-631 — sot/bni-integration.md § 16.4 "Tabel": order by `postDate`
// descending, STABLE (original index breaks ties — `journalNo` repeats within a
// day), rows whose date is MALFORMED (null) sink to the bottom. The backend
// already sends this order; sorting again here costs nothing and guarantees
// the CSV and the table agree even if a future backend forgets.

export interface IndexedStatementRow {
  row: BniStatementRow
  /** Position in the backend response — the tie-breaker and part of the row key. */
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

/** `journalNo` + `postDate` + original index — the only combination that is unique. */
export function statementRowKey({ row, index }: IndexedStatementRow): string {
  return `${row.journalNo ?? ''}-${row.postDate ?? ''}-${index}`
}

/** Client-side page slice for `DataTable` (`rowCount` = total, data = this page). */
export function pageOf<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}
