import { formatUsdxAmount, formatIdrAmount } from '@/lib/format'
import type { ByUserRow } from '@/lib/types'
import CopyableUserId from './CopyableUserId'
import ReportPageShell from './ReportPageShell'
import { useReportPageState } from './useReportPageState'
import ReportTable, { type ReportColumn } from './ReportTable'
import { useMintByUserReport } from './hooks'
import { MINT_STATUS_OPTIONS } from './statusOptions'

const COLUMNS: ReportColumn<ByUserRow>[] = [
  { key: 'userName', header: 'User Name', render: (r) => <span className="font-medium">{r.userName}</span> },
  { key: 'userEmail', header: 'Email', render: (r) => <span className="text-muted-foreground">{r.userEmail || '—'}</span> },
  { key: 'userId', header: 'User ID', render: (r) => <CopyableUserId id={r.userId} /> },
  { key: 'totalCount', header: 'Total Count', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.totalCount}</span> },
  { key: 'totalAmountUsdx', header: 'Total Amount (USDX)', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatUsdxAmount(Number(r.totalAmountUsdx))}</span> },
  { key: 'totalAmountIdr', header: 'Total Amount (IDR)', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatIdrAmount(Number(r.totalAmountIdr))}</span> },
]

export default function MintByUserPage() {
  const state = useReportPageState('mint-by-user')
  const query = useMintByUserReport(state.appliedFilter)

  return (
    <ReportPageShell
      state={state}
      eyebrow="Reporting"
      title="Mint By User"
      italicAccent="aggregate"
      subtitle="Mint volume aggregated per user. Sorted by total USDX, descending."
      statusOptions={MINT_STATUS_OPTIONS}
      showUserPicker
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
