import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import TableToolbar from '@/components/table/TableToolbar'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import GroupedTable, { type GroupedColumn } from '@/components/detail-panel/GroupedTable'
import { canSubmitOtc, useAuth } from '@/lib/auth'
import { formatDate, formatUsdxListAmount } from '@/lib/format'
import {
  OTC_ACTION_STATUSES,
  OTC_HISTORY_STATUSES,
  OTC_KIND_LABEL,
  OTC_PATH,
  findSafeTxFor,
  formatIdrPlain,
  indexSafeTxByHash,
  otcRowState,
} from '@/lib/otc'
import type { RequestListItem, RequestType } from '@/lib/types'
import OtcDetailModal from './OtcDetailModal'
import { useOtcRequests, useOtcSafeQueue } from './hooks'

/** Batas tarikan "Perlu tindakan" — ditarik semua sekaligus, tanpa halaman. */
const ACTION_LIMIT = 100
const HISTORY_PAGE_SIZE = 20

const PAGE_COPY: Record<RequestType, { title: string; subtitle: string; create: string; createTo: string }> = {
  mint: {
    title: 'Mint OTC',
    subtitle: 'Mint OTC untuk partner. Yang menunggu tanda tanganmu ada di paling atas.',
    create: 'Buat mint OTC',
    createTo: '/mint/new',
  },
  burn: {
    title: 'Redeem OTC',
    subtitle: 'Redeem OTC untuk partner. Yang menunggu tanda tanganmu ada di paling atas.',
    create: 'Buat redeem OTC',
    createTo: '/burn/new',
  },
}

/**
 * OTC ▸ Mint / OTC ▸ Redeem — satu halaman per jenis (keputusan PM 10 Okt
 * 2026; fase 1 masih satu tabel gabungan).
 *
 * Status tanda tangan multisig "x dari y" dicocokkan ke tiap baris, dan tanda
 * tangan / eksekusi dilakukan dari footer modal detail (`/otc/mint/:id`,
 * `/otc/redeem/:id`) memakai alur yang sama dengan halaman tanda tangan
 * lengkap (`useSafeTxSigning`).
 */
export default function OtcPage({ type }: { type: RequestType }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: selectedId } = useParams<{ id?: string }>()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const canCreate = canSubmitOtc(user)

  const copy = PAGE_COPY[type]
  const base = OTC_PATH[type]
  const search = params.get('search') ?? ''
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
  const open = (r: RequestListItem, replace = false) => navigate(`${base}/${r.id}${qs}`, { replace })
  const close = () => navigate(`${base}${qs}`)
  // Tautan lama `/otc/:id` dialihkan ke Mint; kalau detailnya ternyata redeem,
  // pindah ke sub-menu yang benar.
  const onWrongType = useCallback(
    (t: RequestType) => {
      if (selectedId) navigate(`${OTC_PATH[t]}/${selectedId}${location.search}`, { replace: true })
    },
    [navigate, selectedId, location.search],
  )

  const rows = [...actionRows, ...historyRows]
  const selectedIndex = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex]! : null
  const prevRow = selectedIndex > 0 ? rows[selectedIndex - 1] : undefined
  const nextRow = selectedIndex >= 0 ? rows[selectedIndex + 1] : undefined

  const columns: GroupedColumn<RequestListItem>[] = [
    {
      id: 'status',
      header: 'Status',
      className: 'w-36 sm:w-48',
      cell: (r) => {
        const s = otcRowState(r, findSafeTxFor(r, safeIndex))
        // Di ponsel status panjang ("1 dari 2 tanda tangan") boleh turun baris
        // daripada keluar dari tepi tabel.
        return (
          <ToneChip tone={s.tone} className="whitespace-normal sm:whitespace-nowrap">
            {s.label}
          </ToneChip>
        )
      },
    },
    {
      id: 'user',
      header: 'Nasabah',
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          {/* Ops-fokus (PM Okt 2026): nama saja di tabel. Wallet tujuan tampil
              ringkas + tombol salin di modal detail. */}
          <span className="font-medium">{r.userName}</span>
          {/* Di ponsel kolom Nominal disembunyikan supaya Status tetap terlihat
              tanpa menggeser tabel; isinya pindah ke sini. */}
          <span className="mt-0.5 text-xs tabular-nums text-muted-foreground sm:hidden">
            {formatUsdxListAmount(r.amount)} USDX
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
        <div className="flex flex-col items-end">
          <span className="font-semibold tabular-nums">{formatUsdxListAmount(r.amount)} USDX</span>
          <span className="text-xs tabular-nums text-muted-foreground">{formatIdrPlain(r.amountIdr)}</span>
        </div>
      ),
    },
    {
      id: 'createdAt',
      header: 'Waktu',
      className: 'hidden w-40 md:table-cell',
      cell: (r) => <span className="tabular-nums text-muted-foreground">{formatDate(r.createdAt)}</span>,
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
      />
      <GroupedTable
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) => `Buka ${OTC_KIND_LABEL[r.type] ?? 'permintaan'} ${r.userName}, ${formatUsdxListAmount(r.amount)} USDX`}
        selectedKey={selectedId ?? null}
        onSelect={(r) => open(r)}
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
                ? search
                  ? 'Tidak ada yang cocok. Coba kata lain, misalnya nama nasabah atau ID.'
                  : `Belum ada permintaan ${copy.title.toLowerCase()}.`
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
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => navigate(copy.createTo)}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              {copy.create}
            </Button>
          ) : undefined
        }
      />
      {list}
      {selectedId && (
        <OtcDetailModal
          requestId={selectedId}
          listItem={selectedRow}
          safeIndex={safeIndex}
          onClose={close}
          pageType={type}
          onWrongType={onWrongType}
          nav={{
            index: selectedIndex >= 0 ? selectedIndex : null,
            total: rows.length,
            onPrev: prevRow ? () => open(prevRow, true) : undefined,
            onNext: nextRow ? () => open(nextRow, true) : undefined,
          }}
        />
      )}
    </div>
  )
}
