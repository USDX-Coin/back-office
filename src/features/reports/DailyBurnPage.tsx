import { formatUsdxAmount, formatIdrAmount } from '@/lib/format'
import type { DailyBurnRow } from '@/lib/types'
import ReportPageShell from './ReportPageShell'
import { useReportPageState } from './useReportPageState'
import ReportTable, { type ReportColumn } from './ReportTable'
import { useDailyBurnReport } from './hooks'
import { BURN_STATUS_OPTIONS } from './statusOptions'

const COLUMNS: ReportColumn<DailyBurnRow>[] = [
  { key: 'date', header: 'Tanggal', render: (r) => <span className="font-mono tabular-nums">{r.date}</span> },
  { key: 'totalCount', header: 'Jumlah', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.totalCount}</span> },
  { key: 'totalAmountUsdx', header: 'Total USDX', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatUsdxAmount(Number(r.totalAmountUsdx))}</span> },
  { key: 'totalAmountIdr', header: 'Total IDR', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatIdrAmount(Number(r.totalAmountIdr))}</span> },
  { key: 'countPendingApproval', header: 'Menunggu', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countPendingApproval}</span> },
  { key: 'countApproved', header: 'Disetujui', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countApproved}</span> },
  { key: 'countExecuted', header: 'Dieksekusi', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countExecuted}</span> },
  { key: 'countIdrTransferred', header: 'Rupiah dikirim', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countIdrTransferred}</span> },
  { key: 'countRejected', header: 'Ditolak', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countRejected}</span> },
]

export default function DailyBurnPage() {
  const state = useReportPageState('burn-daily')
  const query = useDailyBurnReport(state.appliedFilter)

  return (
    <ReportPageShell
      state={state}
      eyebrow="Laporan"
      title="Burn Harian"
      italicAccent="rekap"
      subtitle="Volume burn OTC per hari beserta sebaran statusnya. Seluruh waktu WIB (Asia/Jakarta)."
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
