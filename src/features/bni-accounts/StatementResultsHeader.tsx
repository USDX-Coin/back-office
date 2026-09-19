import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBankAmount } from '@/lib/format'
import type { BniStatement } from '@/lib/types'
import type { BniErrorView } from './errors'
import type { BniStatementParams } from './hooks'
import { historyNotice, recordedThroughLabel } from './statementCopy'
import StatementNotices from './StatementNotices'
import StatementRefreshButton, { StatementRefreshError } from './StatementRefreshButton'
import { anomalyLine, countAnomalyRows, STATEMENT_TYPE_LABEL } from './statementSummary'

// USDX-631 / USDX-692 — § 16.4 "Header hasil" + "Ringkasan", amended by
// § 16.8.8: applied params · "direkam s/d" · pullId, the copy's notices, then
// the summary "menurut salinan USDX". Rendered as the table's toolbar, so it
// sits above the rows and survives an empty result.

export default function StatementResultsHeader({
  applied,
  accountLabel,
  statement,
  onExport,
  exportDisabled,
  onRefresh,
  refreshDisabled,
  refreshing,
  refreshError,
}: {
  applied: BniStatementParams
  accountLabel: string
  statement: BniStatement | undefined
  onExport: () => void
  exportDisabled: boolean
  onRefresh: () => void
  refreshDisabled: boolean
  refreshing: boolean
  refreshError: BniErrorView | null
}) {
  const summary = statement?.summary
  const rows = statement?.rows ?? []
  // A range ENTIRELY before the history has no table to sit above: there the
  // notice takes the place of the `empty` state instead (see the panel).
  const history = statement ? historyNotice(applied, statement.historyAvailableSince) : null
  const historyAboveTable =
    history && history.kind !== 'none' && (history.kind === 'partial' || rows.length > 0)
      ? history.text
      : null

  return (
    <div className="space-y-3 border-b border-border px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0" data-testid="bni-statement-applied">
          <p className="text-sm font-semibold">
            {accountLabel}{' '}
            <span className="font-mono text-2xs font-normal text-muted-foreground">
              {applied.accountNo}
            </span>
          </p>
          <p className="font-mono text-2xs text-muted-foreground">
            {applied.startDate} – {applied.endDate} · {STATEMENT_TYPE_LABEL[applied.type]}
            {statement && (
              <>
                {' · '}
                <span data-testid="bni-statement-recorded-through">
                  {recordedThroughLabel(statement.recordedThrough)}
                </span>
                {' · '}
                {/* § 16.8.8: reading the copy never contacts the bank, so this
                    pullId has NO api_call_log row to trace — unlike the balance
                    header's, which keeps the § 16.4 text. */}
                <span title="pullId (korelasi activity_log)">pull {statement.pullId}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <StatementRefreshButton onRefresh={onRefresh} disabled={refreshDisabled} refreshing={refreshing} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={exportDisabled}
            data-testid="bni-statement-export-csv"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Unduh CSV
          </Button>
        </div>
      </div>

      <StatementRefreshError error={refreshError} />

      <StatementNotices
        historyText={historyAboveTable}
        gaps={statement?.gaps ?? []}
        currency={summary?.currency}
      />

      {summary && (
        <dl
          className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4"
          aria-labelledby="bni-statement-summary-caption"
          data-testid="bni-statement-summary"
        >
          {/* `<dl>` only admits dt/dd/div children — the caption is a div. */}
          <div
            id="bni-statement-summary-caption"
            className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground sm:col-span-2 lg:col-span-4"
          >
            Ringkasan menurut salinan USDX untuk rentang ini
          </div>
          <div>
            <dt className="text-muted-foreground">Saldo awal</dt>
            <dd className="font-mono tabular-nums">
              {formatBankAmount(summary.beginningBalance, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total masuk</dt>
            <dd className="font-mono tabular-nums">
              {formatBankAmount(summary.totalCredit, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total keluar</dt>
            <dd className="font-mono tabular-nums">
              {formatBankAmount(summary.totalDebit, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Saldo akhir</dt>
            <dd className="font-mono tabular-nums" data-testid="bni-statement-closing-balance">
              {formatBankAmount(summary.closingBalance, summary.currency)}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="sr-only">Jumlah baris dan anomali</dt>
            <dd className="text-muted-foreground">
              <span data-testid="bni-statement-row-count">{rows.length} baris ditampilkan</span>
              {' · '}
              <span data-testid="bni-statement-anomalies">
                {anomalyLine(countAnomalyRows(rows))}
              </span>
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
