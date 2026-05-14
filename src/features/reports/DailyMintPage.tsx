import { formatUsdxAmount, formatIdrAmount } from '@/lib/format'
import type { DailyMintRow } from '@/lib/types'
import ReportPageShell from './ReportPageShell'
import { useReportPageState } from './useReportPageState'
import ReportTable, { type ReportColumn } from './ReportTable'
import { useDailyMintReport } from './hooks'
import { MINT_STATUS_OPTIONS } from './statusOptions'

const COLUMNS: ReportColumn<DailyMintRow>[] = [
  { key: 'date', header: 'Date', render: (r) => <span className="font-mono tabular-nums">{r.date}</span> },
  { key: 'totalCount', header: 'Total Count', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.totalCount}</span> },
  { key: 'totalAmountUsdx', header: 'Total Amount (USDX)', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatUsdxAmount(Number(r.totalAmountUsdx))}</span> },
  { key: 'totalAmountIdr', header: 'Total Amount (IDR)', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatIdrAmount(Number(r.totalAmountIdr))}</span> },
  { key: 'countPendingApproval', header: 'Pending Approval', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countPendingApproval}</span> },
  { key: 'countApproved', header: 'Approved', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countApproved}</span> },
  { key: 'countExecuted', header: 'Executed', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countExecuted}</span> },
  { key: 'countRejected', header: 'Rejected', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countRejected}</span> },
]

export default function DailyMintPage() {
  const state = useReportPageState('mint-daily')
  const query = useDailyMintReport(state.appliedFilter)

  return (
    <ReportPageShell
      state={state}
      eyebrow="Reporting"
      title="Daily Mint"
      italicAccent="aggregate"
      subtitle="Per-day mint volume and status mix. All times Asia/Jakarta."
      statusOptions={MINT_STATUS_OPTIONS}
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
