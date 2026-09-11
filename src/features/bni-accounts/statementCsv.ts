import { exportToCsv } from '@/lib/csv'
import { formatBniPostDate } from '@/lib/format'
import type { BniStatementApplied, BniStatementRow } from '@/lib/types'
import { sortStatementRows } from './statementRows'

// USDX-631 — sot/bni-integration.md § 16.4 "CSV" (K6): the WHOLE filtered
// result in table order, bank columns as-is, amount unsigned + a D/C column,
// `postDate` re-punctuated, MALFORMED cells EMPTY (not "—"), BOM opt-in. The
// formula guard in `lib/csv` still applies to descriptions starting with
// `= + - @`. No anomaly column — the count lives in the on-screen summary.

export interface StatementCsvRow {
  postDate: string
  flag: string
  amount: string
  balance: string
  description: string
  journalNo: string
  branchName: string
}

export const STATEMENT_CSV_COLUMNS: { key: keyof StatementCsvRow; header: string }[] = [
  { key: 'postDate', header: 'Tanggal Posting' },
  { key: 'flag', header: 'D/C' },
  { key: 'amount', header: 'Nominal' },
  { key: 'balance', header: 'Saldo' },
  { key: 'description', header: 'Deskripsi' },
  { key: 'journalNo', header: 'No. Jurnal' },
  { key: 'branchName', header: 'Cabang' },
]

function cell(value: string | null | undefined): string {
  return value ?? ''
}

export function toStatementCsvRows(rows: readonly BniStatementRow[]): StatementCsvRow[] {
  return sortStatementRows(rows).map(({ row }) => {
    const postDate = formatBniPostDate(row.postDate)
    return {
      postDate: postDate === '—' ? '' : postDate,
      flag: row.flag,
      amount: cell(row.amount),
      balance: cell(row.balance),
      description: row.description,
      journalNo: cell(row.journalNo),
      branchName: cell(row.branchName),
    }
  })
}

/** `mutasi-bni-<accountNo>-<YYYYMMDD>-<YYYYMMDD>-<ALL|CREDIT|DEBIT>` (extension added by exportToCsv). */
export function statementCsvFilename(applied: BniStatementApplied): string {
  const compact = (iso: string) => iso.replace(/-/g, '')
  return `mutasi-bni-${applied.accountNo}-${compact(applied.startDate)}-${compact(applied.endDate)}-${applied.type}`
}

export function exportStatementCsv(
  applied: BniStatementApplied,
  rows: readonly BniStatementRow[]
): void {
  exportToCsv(toStatementCsvRows(rows), STATEMENT_CSV_COLUMNS, statementCsvFilename(applied), {
    withBom: true,
  })
}
