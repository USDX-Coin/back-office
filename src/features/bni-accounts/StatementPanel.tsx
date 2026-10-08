import { useState } from 'react'
import { History, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
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
import type { BniAccount, BniStatementType } from '@/lib/types'
import { describeBniError } from './errors'
import { useBniStatement, useRefreshStatement, type BniStatementParams } from './hooks'
import { historyNotice, refreshResultText } from './statementCopy'
import { exportStatementCsv } from './statementCsv'
import StatementRefreshButton, { StatementRefreshError } from './StatementRefreshButton'
import StatementResultsHeader from './StatementResultsHeader'
import { sortStatementRows } from './statementRows'
import { STATEMENT_TYPE_LABEL } from './statementSummary'
import StatementTable from './StatementTable'

// USDX-631 / USDX-692 — sot/bni-integration.md § 16.4 "Panel mutasi" / "Tabel"
// / "CSV", amended by § 16.8.8 (D24): "Tarik" reads the USDX COPY of the
// statement — zero bank contact — and "Segarkan dari bank" is the only thing
// here that reaches the bank. The form is a DRAFT; "Tarik" snapshots it into
// the applied params that key the query, so the result header always names
// what was actually pulled even while the operator edits the form.

const PAGE_SIZE = 10
const MAX_DAYS = 31
const LABEL_CLASS = 'text-xs font-medium text-muted-foreground'
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

interface Props {
  accounts: readonly BniAccount[]
}

export default function StatementPanel({ accounts }: Props) {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [applied, setApplied] = useState<BniStatementParams | null>(null)
  const statement = useBniStatement(applied)
  // § 16.8.8 "aktif hanya bila rekening sudah dipilih": with a result on screen
  // the target is the APPLIED account (the one the header names, whatever the
  // form says now); before any pull it is the account picked in the form.
  const refreshTarget = applied?.accountNo ?? (draft.accountNo !== NO_ACCOUNT ? draft.accountNo : null)
  const refresh = useRefreshStatement(refreshTarget)
  const tableParams = useDataTableParams()

  // "Today" is read when a preset / Tarik is pressed, not at mount — an
  // operator in WITA/WIT or on a UTC laptop must still get the WIB day.
  const datesEmpty = draft.startDate === '' && draft.endDate === ''
  const rules = { maxDays: MAX_DAYS, maxDate: todayInJakarta() }
  const verdict = datesEmpty ? { valid: true } : validateDateRange(draft, rules)
  // Tarik and Segarkan never overlap: a pull issued mid-refresh would re-read
  // the copy BEFORE the bank's entries are stored and then miss the refetch.
  const canPull =
    draft.accountNo !== NO_ACCOUNT && verdict.valid && !statement.isFetching && !refresh.isPending

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
    // A refresh failure belongs to the result it was shown on.
    refresh.reset()
    if (applied && sameParams(applied, next)) {
      // Same parameters again = an explicit re-pull, never a cache hit.
      void statement.refetch()
      return
    }
    setApplied(next)
  }

  function refreshFromBank() {
    if (!refreshTarget || refresh.isPending || statement.isFetching) return
    refresh.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(refreshResultText(result))
        // Re-read the copy under the APPLIED key — never the live form. Before
        // the first Tarik there is no result to re-read: the entries are stored
        // and the next Tarik shows them.
        if (applied) void statement.refetch()
      },
    })
  }

  const refreshError = refresh.error ? describeBniError(refresh.error) : null
  // The results header carries its own; `idle` and `error` have no header.
  const refreshStrip = (
    <div className="space-y-3 border-b border-border px-4 py-3">
      <div className="flex justify-end">
        <StatementRefreshButton
          onRefresh={refreshFromBank}
          disabled={refreshTarget === null || refresh.isPending || statement.isFetching}
          refreshing={refresh.isPending}
        />
      </div>
      <StatementRefreshError error={refreshError} />
    </div>
  )

  const appliedAccount = applied
    ? accounts.find((a) => a.accountNo === applied.accountNo) ?? null
    : null
  const sorted = statement.data ? sortStatementRows(statement.data.rows) : []
  const errorView = statement.error ? describeBniError(statement.error) : null
  const history =
    applied && statement.data ? historyNotice(applied, statement.data.historyAvailableSince) : null

  return (
    <section aria-labelledby="bni-statement-heading">
      <h2 id="bni-statement-heading" className="mb-3 text-base font-semibold tracking-tight">
        Mutasi rekening
      </h2>

      <div className="mb-4 grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Rekening</Label>
          <Select
            value={draft.accountNo}
            onValueChange={(accountNo) => {
              // Before the first Tarik the form's account IS the refresh target:
              // a failure shown for the previous pick must not outlive it.
              if (!applied) refresh.reset()
              setDraft((d) => ({ ...d, accountNo }))
            }}
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
          <span className="text-2xs text-muted-foreground">Preset (WIB):</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset(0)}>
            Hari ini
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset(6)}>
            7 hari terakhir
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => applyPreset(30)}>
            31 hari terakhir
          </Button>
          <span className="text-2xs text-muted-foreground">
            Kosong = hari ini. Maksimum {MAX_DAYS} hari.
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        {applied === null ? (
          <>
            {refreshStrip}
            <TableEmptyState
              mode="no-data"
              title="Belum ada tarikan"
              description="Pilih rekening dan rentang, lalu tekan Tarik untuk melihat mutasi."
            />
          </>
        ) : errorView ? (
          <>
            {refreshStrip}
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center" role="alert">
              <p className="text-sm font-medium text-destructive">{errorView.message}</p>
              {errorView.retryable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void statement.refetch()}
                  disabled={statement.isFetching || refresh.isPending}
                >
                  Coba lagi
                </Button>
              )}
            </div>
          </>
        ) : (
          <StatementTable
            rows={sorted}
            page={tableParams.page}
            pageSize={PAGE_SIZE}
            currency={statement.data?.summary.currency}
            isLoading={statement.isPending}
            toolbar={
              <StatementResultsHeader
                applied={applied}
                accountLabel={statement.data?.applied.label ?? appliedAccount?.label ?? 'Rekening'}
                statement={statement.data}
                exportDisabled={sorted.length === 0 || statement.isFetching}
                onRefresh={refreshFromBank}
                refreshDisabled={refresh.isPending || statement.isFetching}
                refreshing={refresh.isPending}
                refreshError={refreshError}
                onExport={() => {
                  if (!statement.data) return
                  exportStatementCsv(statement.data.applied, statement.data.rows)
                }}
              />
            }
            emptyState={
              // § 16.8.8: a range the copy cannot cover is NOT "no mutations" —
              // the operator is pointed at the portal, never told the account was quiet.
              history?.kind === 'entire' ? (
                <div
                  className="flex flex-col items-center gap-3 px-4 py-12 text-center"
                  role="status"
                  data-testid="bni-statement-history-notice"
                >
                  <History className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} aria-hidden />
                  <p className="max-w-xl text-sm font-medium text-foreground">{history.text}</p>
                </div>
              ) : (
                <TableEmptyState
                  mode="no-data"
                  title="Tidak ada mutasi terekam pada rentang ini"
                  description="Salinan USDX tidak memuat mutasi untuk rekening, rentang, dan jenis yang diterapkan."
                />
              )
            }
          />
        )}
      </div>
    </section>
  )
}
