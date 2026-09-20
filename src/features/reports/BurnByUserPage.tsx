import { formatUsdxAmount, formatIdrAmount } from '@/lib/format'
import type { ByUserRow } from '@/lib/types'
import CopyableUserId from './CopyableUserId'
import ReportPageShell from './ReportPageShell'
import { useReportPageState } from './useReportPageState'
import ReportTable, { type ReportColumn } from './ReportTable'
import { useBurnByUserReport } from './hooks'
import { BURN_STATUS_OPTIONS } from './statusOptions'

const COLUMNS: ReportColumn<ByUserRow>[] = [
  { key: 'userName', header: 'Nasabah', render: (r) => <span className="font-medium">{r.userName}</span> },
  { key: 'userEmail', header: 'Email', render: (r) => <span className="text-muted-foreground">{r.userEmail || '—'}</span> },
  { key: 'userId', header: 'ID Nasabah', render: (r) => <CopyableUserId id={r.userId} /> },
  { key: 'totalCount', header: 'Jumlah', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.totalCount}</span> },
  { key: 'totalAmountUsdx', header: 'Total USDX', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatUsdxAmount(Number(r.totalAmountUsdx))}</span> },
  { key: 'totalAmountIdr', header: 'Total IDR', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatIdrAmount(Number(r.totalAmountIdr))}</span> },
]

export default function BurnByUserPage() {
  const state = useReportPageState('burn-by-user')
  const query = useBurnByUserReport(state.appliedFilter)

  return (
    <ReportPageShell
      state={state}
      eyebrow="Laporan"
      title="Burn per Nasabah"
      italicAccent="rekap"
      subtitle="Volume burn OTC dijumlahkan per nasabah. Diurutkan dari total USDX terbesar."
      statusOptions={BURN_STATUS_OPTIONS}
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
