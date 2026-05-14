import { formatUsdxAmount, formatIdrAmount } from '@/lib/format'
import type { DailyBurnRow } from '@/lib/types'
import ReportPageShell from './ReportPageShell'
import { useReportPageState } from './useReportPageState'
import ReportTable, { type ReportColumn } from './ReportTable'
import { useDailyBurnReport } from './hooks'
import { BURN_STATUS_OPTIONS } from './statusOptions'

const COLUMNS: ReportColumn<DailyBurnRow>[] = [
  { key: 'date', header: 'Date', render: (r) => <span className="font-mono tabular-nums">{r.date}</span> },
  { key: 'totalCount', header: 'Total Count', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.totalCount}</span> },
  { key: 'totalAmountUsdx', header: 'Total Amount (USDX)', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatUsdxAmount(Number(r.totalAmountUsdx))}</span> },
  { key: 'totalAmountIdr', header: 'Total Amount (IDR)', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatIdrAmount(Number(r.totalAmountIdr))}</span> },
  { key: 'countPendingApproval', header: 'Pending Approval', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countPendingApproval}</span> },
  { key: 'countApproved', header: 'Approved', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countApproved}</span> },
  { key: 'countExecuted', header: 'Executed', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countExecuted}</span> },
  { key: 'countIdrTransferred', header: 'IDR Transferred', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countIdrTransferred}</span> },
  { key: 'countRejected', header: 'Rejected', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countRejected}</span> },
]

export default function DailyBurnPage() {
  const state = useReportPageState('burn-daily')
  const query = useDailyBurnReport(state.appliedFilter)

  return (
    <ReportPageShell
      state={state}
      eyebrow="Reporting"
      title="Daily Burn"
      italicAccent="aggregate"
      subtitle="Per-day burn volume and status mix. All times Asia/Jakarta."
      statusOptions={BURN_STATUS_OPTIONS}
      showUserPicker={false}
      isFetching={query.isFetching}
    >
      <ReportTable
        columns={COLUMNS}
        rows={query.data ?? []}
        isFetching={query.isFetching}
        isError={query.isError}
      />
    </ReportPageShell>
  )
}
