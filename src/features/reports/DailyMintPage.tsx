import { formatUsdxAmount, formatIdrAmount } from '@/lib/format'
import type { DailyMintRow } from '@/lib/types'
import ReportPageShell from './ReportPageShell'
import { useReportPageState } from './useReportPageState'
import ReportTable, { type ReportColumn } from './ReportTable'
import { useDailyMintReport } from './hooks'
import { MINT_STATUS_OPTIONS } from './statusOptions'

const COLUMNS: ReportColumn<DailyMintRow>[] = [
  { key: 'date', header: 'Tanggal', render: (r) => <span className="font-mono tabular-nums">{r.date}</span> },
  { key: 'totalCount', header: 'Jumlah', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.totalCount}</span> },
  { key: 'totalAmountUsdx', header: 'Total USDX', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatUsdxAmount(Number(r.totalAmountUsdx))}</span> },
  { key: 'totalAmountIdr', header: 'Total IDR', align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatIdrAmount(Number(r.totalAmountIdr))}</span> },
  { key: 'countPendingApproval', header: 'Menunggu', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countPendingApproval}</span> },
  { key: 'countApproved', header: 'Disetujui', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countApproved}</span> },
  { key: 'countExecuted', header: 'Dieksekusi', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countExecuted}</span> },
  { key: 'countRejected', header: 'Ditolak', align: 'right', render: (r) => <span className="font-mono tabular-nums">{r.countRejected}</span> },
]

export default function DailyMintPage() {
  const state = useReportPageState('mint-daily')
  const query = useDailyMintReport(state.appliedFilter)

  return (
    <ReportPageShell
      state={state}
      eyebrow="Laporan"
      title="Mint Harian"
      italicAccent="rekap"
      subtitle="Volume mint OTC per hari beserta sebaran statusnya. Seluruh waktu WIB (Asia/Jakarta)."
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
