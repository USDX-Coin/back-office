import { useState } from 'react'
import { Download, Loader2, Play } from 'lucide-react'
import DateRangeFields from '@/components/DateRangeFields'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { shiftIsoDate, todayInJakarta } from '@/features/reports/dateRange'
import { validateDateRange } from '@/lib/dateRange'
import { formatBankAmount, formatBniPostDate, formatWibDateTime } from '@/lib/format'
import type { BniAccount, BniStatement, BniStatementType } from '@/lib/types'
import { describeBniError } from './errors'
import { useBniStatement, type BniStatementParams } from './hooks'
import { exportStatementCsv } from './statementCsv'
import { sortStatementRows } from './statementRows'
import { anomalyLine, countAnomalyRows, postingRangeDiffers, STATEMENT_TYPE_LABEL } from './statementSummary'
import StatementTable from './StatementTable'

// USDX-631 — sot/bni-integration.md § 16.4 "Panel mutasi" / "Ringkasan" /
// "Tabel" / "CSV". The form is a DRAFT; "Tarik" snapshots it into the applied
// params that key the query, so the result header always names what was
// actually pulled even while the operator edits the form.

const PAGE_SIZE = 10
const MAX_DAYS = 31
const LABEL_CLASS = 'text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground'
const NO_ACCOUNT = ''

interface Draft {
  accountNo: string
  startDate: string
  endDate: string
  type: BniStatementType
}

const INITIAL_DRAFT: Draft = { accountNo: NO_ACCOUNT, startDate: '', endDate: '', type: 'ALL' }

function sameParams(a: BniStatementParams, b: BniStatementParams): boolean {
  return (
    a.accountNo === b.accountNo &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.type === b.type
  )
}

function ResultsHeader({
  applied,
  accountLabel,
  statement,
  onExport,
  exportDisabled,
}: {
  applied: BniStatementParams
  accountLabel: string
  statement: BniStatement | undefined
  onExport: () => void
  exportDisabled: boolean
}) {
  const summary = statement?.summary
  const rows = statement?.rows ?? []
  const rangeDiffers =
    summary !== undefined &&
    postingRangeDiffers(applied, summary.fromPostingDate, summary.toPostingDate)

  return (
    <div className="space-y-3 border-b border-border px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0" data-testid="bni-statement-applied">
          <p className="text-[13px] font-semibold">
            {accountLabel}{' '}
            <span className="font-mono text-[11.5px] font-normal text-muted-foreground">
              {applied.accountNo}
            </span>
          </p>
          <p className="font-mono text-[11.5px] text-muted-foreground">
            {applied.startDate} – {applied.endDate} · {STATEMENT_TYPE_LABEL[applied.type]}
            {statement && (
              <>
                {' · '}Tarikan {formatWibDateTime(statement.pulledAt)}
                {' · '}
                <span title="pullId (korelasi activity_log ↔ api_call_log)">pull {statement.pullId}</span>
              </>
            )}
          </p>
        </div>
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

      {summary && (
        <dl
          className="grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Ringkasan menurut bank untuk rentang ini"
          data-testid="bni-statement-summary"
        >
          <div>
            <dt className="text-muted-foreground">Saldo awal (menurut bank)</dt>
            <dd className="font-mono tabular-nums">
              {formatBankAmount(summary.beginningBalance, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total masuk (menurut bank)</dt>
            <dd className="font-mono tabular-nums">
              {formatBankAmount(summary.totalCredit, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total keluar (menurut bank)</dt>
            <dd className="font-mono tabular-nums">
              {formatBankAmount(summary.totalDebit, summary.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rentang posting berlaku (menurut bank)</dt>
            <dd className="font-mono tabular-nums">
              {formatBniPostDate(summary.fromPostingDate)} – {formatBniPostDate(summary.toPostingDate)}
              {rangeDiffers && (
                <span className="ml-1.5 font-sans text-warning">(beda dari yang diminta)</span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="sr-only">Jumlah baris dan anomali</dt>
            <dd className="text-muted-foreground">
              <span data-testid="bni-statement-row-count">{rows.length} baris ditampilkan</span>
              {' · '}
              <span data-testid="bni-statement-anomalies">
                {anomalyLine(countAnomalyRows(rows), summary.anomalies)}
              </span>
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}

interface Props {
  accounts: readonly BniAccount[]
}

export default function StatementPanel({ accounts }: Props) {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [applied, setApplied] = useState<BniStatementParams | null>(null)
  const statement = useBniStatement(applied)
  const tableParams = useDataTableParams()

  // "Today" is read when a preset / Tarik is pressed, not at mount — an
  // operator in WITA/WIT or on a UTC laptop must still get the WIB day.
  const datesEmpty = draft.startDate === '' && draft.endDate === ''
  const rules = { maxDays: MAX_DAYS, maxDate: todayInJakarta() }
  const verdict = datesEmpty ? { valid: true } : validateDateRange(draft, rules)
  const canPull = draft.accountNo !== NO_ACCOUNT && verdict.valid && !statement.isFetching

  function applyPreset(daysBack: number) {
    const today = todayInJakarta()
    setDraft((d) => ({ ...d, startDate: shiftIsoDate(today, -daysBack), endDate: today }))
  }

  function pull() {
    if (!canPull) return
    const today = todayInJakarta()
    const range = datesEmpty
      ? { startDate: today, endDate: today }
      : { startDate: draft.startDate, endDate: draft.endDate }
    if (datesEmpty) setDraft((d) => ({ ...d, ...range }))
    const next: BniStatementParams = { accountNo: draft.accountNo, ...range, type: draft.type }
    // Every pull starts on page 1: a re-pull can return fewer rows than the
    // page the operator was on, and a stale `?page=` would render a false
    // "no rows" state (review finding, USDX-631).
    tableParams.updateParams({ page: null })
    if (applied && sameParams(applied, next)) {
      // Same parameters again = an explicit re-pull, never a cache hit.
      void statement.refetch()
      return
    }
    setApplied(next)
  }

  const appliedAccount = applied
    ? accounts.find((a) => a.accountNo === applied.accountNo) ?? null
    : null
  const sorted = statement.data ? sortStatementRows(statement.data.rows) : []
  const errorView = statement.error ? describeBniError(statement.error) : null

  return (
    <section aria-labelledby="bni-statement-heading">
      <h2 id="bni-statement-heading" className="mb-3 text-[15px] font-semibold tracking-tight">
        Mutasi rekening
      </h2>

      <div className="mb-4 grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Rekening</Label>
          <Select
            value={draft.accountNo}
            onValueChange={(accountNo) => setDraft((d) => ({ ...d, accountNo }))}
          >
            <SelectTrigger className="h-9 bg-card" aria-label="Rekening">
              <SelectValue placeholder="Pilih rekening" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.accountNo} value={a.accountNo}>
                  {a.label} · {a.accountNo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DateRangeFields
          idPrefix="bni-statement"
          value={{ startDate: draft.startDate, endDate: draft.endDate }}
          onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
          labels={{ start: 'Tanggal mulai', end: 'Tanggal akhir' }}
          maxDays={MAX_DAYS}
          maxDate={rules.maxDate}
        />

        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Jenis</Label>
          <Select
            value={draft.type}
            onValueChange={(type) => setDraft((d) => ({ ...d, type: type as BniStatementType }))}
          >
            <SelectTrigger className="h-9 bg-card" aria-label="Jenis mutasi">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATEMENT_TYPE_LABEL) as BniStatementType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {STATEMENT_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            onClick={pull}
            disabled={!canPull}
            className="h-9 w-full sm:w-auto"
            data-testid="bni-statement-pull"
          >
            {statement.isFetching ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            Tarik
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 lg:col-span-5">
          <span className="text-[11px] text-muted-foreground">Preset (WIB):</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset(0)}>
            Hari ini
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset(6)}>
            7 hari terakhir
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset(30)}>
            31 hari terakhir
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Kosong = hari ini. Maksimum {MAX_DAYS} hari.
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        {applied === null ? (
          <TableEmptyState
            mode="no-data"
            title="Belum ada tarikan"
            description="Pilih rekening dan rentang, lalu tekan Tarik untuk melihat mutasi."
          />
        ) : errorView ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center" role="alert">
            <p className="text-[13px] font-medium text-destructive">{errorView.message}</p>
            {errorView.retryable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void statement.refetch()}
                disabled={statement.isFetching}
              >
                Coba lagi
              </Button>
            )}
          </div>
        ) : (
          <StatementTable
            rows={sorted}
            page={tableParams.page}
            pageSize={PAGE_SIZE}
            currency={statement.data?.summary.currency}
            isLoading={statement.isPending}
            toolbar={
              <ResultsHeader
                applied={applied}
                accountLabel={statement.data?.applied.label ?? appliedAccount?.label ?? 'Rekening'}
                statement={statement.data}
                exportDisabled={sorted.length === 0 || statement.isFetching}
                onExport={() => {
                  if (!statement.data) return
                  exportStatementCsv(statement.data.applied, statement.data.rows)
                }}
              />
            }
            emptyState={
              <TableEmptyState
                mode="no-data"
                title="Tidak ada mutasi pada rentang ini"
                description="Bank tidak mengembalikan transaksi untuk rekening, rentang, dan jenis yang diterapkan."
              />
            }
          />
        )}
      </div>
    </section>
  )
}
