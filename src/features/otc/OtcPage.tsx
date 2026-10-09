import { useMemo } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import TableToolbar from '@/components/table/TableToolbar'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import GroupedTable, { type GroupedColumn } from '@/components/detail-panel/GroupedTable'
import SplitView from '@/components/detail-panel/SplitView'
import { canSubmitOtc, useAuth } from '@/lib/auth'
import { formatShortDate, formatUsdxListAmount, truncateMiddle } from '@/lib/format'
import {
  OTC_ACTION_STATUSES,
  OTC_HISTORY_STATUSES,
  OTC_KIND_LABEL,
  findSafeTxFor,
  formatIdrPlain,
  indexSafeTxByHash,
  otcRowState,
} from '@/lib/otc'
import type { RequestListItem, RequestType } from '@/lib/types'
import OtcDetailPanel from './OtcDetailPanel'
import { useOtcRequests, useOtcSafeQueue } from './hooks'

/** Batas tarikan "Perlu tindakan" — ditarik semua sekaligus, tanpa halaman. */
const ACTION_LIMIT = 100
const HISTORY_PAGE_SIZE = 20

/**
 * OTC — satu tabel untuk mint OTC + redeem OTC (redesain fase 1).
 *
 * Menggantikan dua menu lama (Mint OTC, Burn OTC) dan menu Antrean Tanda
 * Tangan: status tanda tangan multisig "x dari y" dicocokkan ke tiap baris,
 * dan tanda tangan / eksekusi dilakukan dari panel detail kanan memakai alur
 * yang sama dengan halaman tanda tangan lengkap (`useSafeTxSigning`).
 */
export default function OtcPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: selectedId } = useParams<{ id?: string }>()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const canCreate = canSubmitOtc(user)

  const search = params.get('search') ?? ''
  const jenisParam = params.get('jenis')
  const type: RequestType | '' = jenisParam === 'mint' || jenisParam === 'burn' ? jenisParam : ''
  const page = Math.max(1, Number(params.get('page') || '1') || 1)

  const actionQ = useOtcRequests({ statuses: OTC_ACTION_STATUSES, limit: ACTION_LIMIT, search, type })
  const historyQ = useOtcRequests({
    statuses: OTC_HISTORY_STATUSES,
    limit: HISTORY_PAGE_SIZE,
    page,
    search,
    type,
  })
  const safeQ = useOtcSafeQueue()
  const safeIndex = useMemo(() => indexSafeTxByHash(safeQ.data ?? []), [safeQ.data])

  const actionRows = actionQ.data?.data ?? []
  const actionTotal = actionQ.data?.metadata.total ?? 0
  const historyRows = historyQ.data?.data ?? []
  const historyTotal = historyQ.data?.metadata.total ?? 0
  const pageCount = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    setParams(sp, { replace: true })
  }

  const qs = location.search
  const select = (r: RequestListItem) => navigate(`/otc/${r.id}${qs}`)
  const close = () => navigate(`/otc${qs}`)

  const selectedRow =
    (selectedId && [...actionRows, ...historyRows].find((r) => r.id === selectedId)) || null

  const columns: GroupedColumn<RequestListItem>[] = [
    {
      id: 'createdAt',
      header: 'Tanggal',
      className: 'hidden w-28 md:table-cell',
      cell: (r) => <span className="tabular-nums text-muted-foreground">{formatShortDate(r.createdAt)}</span>,
    },
    {
      id: 'type',
      header: 'Jenis',
      className: 'hidden w-28 sm:table-cell',
      cell: (r) => <span className="text-muted-foreground">{OTC_KIND_LABEL[r.type] ?? r.type}</span>,
    },
    {
      id: 'user',
      header: 'Nasabah',
      cell: (r) => (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-semibold">{r.userName}</span>
          <span className="font-mono text-xs text-muted-foreground" title={r.userAddress}>
            {truncateMiddle(r.userAddress, 6, 5)}
          </span>
          {/* Di ponsel kolom Jenis + Nominal disembunyikan supaya Status tetap
              terlihat tanpa menggeser tabel; isinya pindah ke sini. */}
          <span className="mt-0.5 text-xs text-muted-foreground sm:hidden">
            {OTC_KIND_LABEL[r.type] ?? r.type} · <span className="tabular-nums">{formatUsdxListAmount(r.amount)} USDX</span>
          </span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Nominal',
      align: 'right',
      className: 'hidden w-44 sm:table-cell',
      cell: (r) => (
        <div className="flex flex-col items-end leading-tight">
          <span className="font-semibold tabular-nums">{formatUsdxListAmount(r.amount)} USDX</span>
          <span className="text-xs tabular-nums text-muted-foreground">{formatIdrPlain(r.amountIdr)}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-36 sm:w-48',
      cell: (r) => {
        const s = otcRowState(r, findSafeTxFor(r, safeIndex))
        return <ToneChip tone={s.tone}>{s.label}</ToneChip>
      },
    },
  ]

  const list = (
    <div className="space-y-3">
      <TableToolbar
        search={{
          value: search,
          placeholder: 'Cari nama nasabah, alamat wallet, atau ID',
          ariaLabel: 'Cari permintaan OTC',
          onChange: (next) => update({ search: next.trim() || null, page: null }),
        }}
        extra={
          <>
            <label className="sr-only" htmlFor="otc-jenis">
              Jenis
            </label>
            <select
              id="otc-jenis"
              value={type}
              onChange={(e) => update({ jenis: e.target.value || null, page: null })}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Semua jenis</option>
              <option value="mint">Mint OTC</option>
              <option value="burn">Redeem OTC</option>
            </select>
          </>
        }
      />
      <GroupedTable
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) => `Buka ${OTC_KIND_LABEL[r.type] ?? 'permintaan'} ${r.userName}, ${formatUsdxListAmount(r.amount)} USDX`}
        selectedKey={selectedId ?? null}
        onSelect={select}
        groups={[
          {
            key: 'action',
            label: 'Perlu tindakan',
            emphasis: true,
            rows: actionRows,
            total: actionTotal,
            isLoading: actionQ.isLoading,
            isError: actionQ.isError,
            onRetry: () => actionQ.refetch(),
            note:
              [
                actionTotal > actionRows.length
                  ? `${actionRows.length} ditampilkan — cari nama untuk menemukan sisanya`
                  : null,
                safeQ.isError ? 'Status tanda tangan gagal dimuat' : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined,
          },
          {
            key: 'history',
            label: actionRows.length > 0 ? 'Lainnya' : 'Semua',
            rows: historyRows,
            total: historyTotal,
            isLoading: historyQ.isLoading,
            isError: historyQ.isError,
            onRetry: () => historyQ.refetch(),
            emptyText:
              actionRows.length === 0 && !actionQ.isLoading
                ? search || type
                  ? 'Tidak ada yang cocok. Coba kata lain, misalnya nama nasabah atau ID.'
                  : 'Belum ada permintaan OTC.'
                : 'Belum ada yang selesai.',
            pagination: { page, pageCount, onPage: (p) => update({ page: p > 1 ? String(p) : null }) },
          },
        ]}
      />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="OTC"
        subtitle="Mint dan redeem OTC untuk partner. Yang menunggu tanda tanganmu ada di paling atas."
        actions={
          canCreate ? (
            <>
              <Button size="sm" onClick={() => navigate('/mint/new')}>
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Buat mint OTC
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/burn/new')}>
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Buat redeem OTC
              </Button>
            </>
          ) : undefined
        }
      />
      <SplitView
        list={list}
        panel={
          selectedId ? (
            <OtcDetailPanel
              requestId={selectedId}
              listItem={selectedRow}
              safeIndex={safeIndex}
              onClose={close}
            />
          ) : null
        }
      />
    </div>
  )
}
