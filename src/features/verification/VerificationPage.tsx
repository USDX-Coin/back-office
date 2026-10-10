import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import TableToolbar from '@/components/table/TableToolbar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ToneChip } from '@/components/ToneChip'
import GroupedTable, { type GroupedColumn } from '@/components/table/GroupedTable'
import KycDetailModal from '@/features/kyc/KycDetailModal'
import KybDetailModal from '@/features/kyb/KybDetailModal'
import { useQueries } from '@tanstack/react-query'
import { kycListQueryOptions, useKycList } from '@/features/kyc/hooks'
import { kybListQueryOptions, useKybList } from '@/features/kyb/hooks'
import { canReviewKyc, useAuth } from '@/lib/auth'
import { formatShortDate } from '@/lib/format'
import type { KybListItem, KycListItem } from '@/lib/types'
import {
  VERIFICATION_KIND_LABEL,
  fromKyb,
  fromKyc,
  mergeBySubmitted,
  parseVerificationKind,
  verificationStatus,
  type VerificationKind,
  type VerificationRow,
} from '@/lib/verification'

/** Antrean menunggu ditarik semua sekaligus (per jenis). */
const PENDING_LIMIT = 100
/** Ukuran halaman riwayat PER JENIS — satu halaman memuat paling banyak 2× ini. */
const HISTORY_PAGE_SIZE = 10

type HistoryFilter = 'all' | 'VERIFIED' | 'REJECTED'

/**
 * Verifikasi — KYC perorangan + KYB badan usaha dalam SATU tabel (redesain
 * fase 1). Yang menunggu diperiksa selalu di atas, terlama dulu; di bawahnya
 * berkas yang sudah diputuskan (disetujui + ditolak, bisa disaring salah
 * satunya). Kedua endpoint hanya menerima satu `status`, jadi tiap pasangan
 * (sumber × keputusan) ditarik sendiri dan berhalaman serempak.
 *
 * Klik baris → modal berkas di TENGAH (`/verifikasi/:jenis/:id`; rute lama
 * `/kyc/:id` dan `/kyb/:id` membuka modal yang sama). Tabel tetap lebar penuh —
 * tidak ada panel samping (PM Okt 2026). ↑/↓ di modal berpindah ke berkas
 * sebelum/sesudahnya di tabel ini, urutan yang sama dengan yang terlihat.
 *
 * Data berkas (PII terdekripsi + presigned URL) HANYA ditarik saat modal
 * berkas itu terbuka — tabel sendiri tidak pernah menariknya.
 */
/** Nilai Radix Select untuk "tanpa saringan" — Select tidak menerima string kosong. */
const SEMUA = 'semua'

export default function VerificationPage({ detail }: { detail?: VerificationKind }) {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ jenis?: string; id?: string }>()
  const [sp, setSp] = useSearchParams()
  const { user } = useAuth()

  const selectedKind = detail ?? parseVerificationKind(params.jenis)
  const selectedId = params.id ?? null

  const jenis = parseVerificationKind(sp.get('jenis'))
  const search = sp.get('search') ?? ''
  const riwayat = sp.get('riwayat')
  const history: HistoryFilter =
    riwayat === 'ditolak' ? 'REJECTED' : riwayat === 'disetujui' ? 'VERIFIED' : 'all'
  const historyStatuses: Array<'VERIFIED' | 'REJECTED'> =
    history === 'all' ? ['VERIFIED', 'REJECTED'] : [history]
  const page = Math.max(1, Number(sp.get('page') || '1') || 1)

  const wantKyc = jenis !== 'badan-usaha'
  const wantKyb = jenis !== 'perorangan'

  const pendingKyc = useKycList({ status: 'PENDING', limit: PENDING_LIMIT, search: search || undefined }, wantKyc)
  const pendingKyb = useKybList({ status: 'PENDING', limit: PENDING_LIMIT, search: search || undefined }, wantKyb)
  // Riwayat = berkas yang SUDAH diputuskan. Kedua endpoint hanya menerima satu
  // `status`, jadi tiap (sumber × keputusan) satu tarikan, berhalaman serempak.
  const histFilters = (status: 'VERIFIED' | 'REJECTED') => ({
    status,
    page,
    limit: HISTORY_PAGE_SIZE,
    search: search || undefined,
  })
  const histKycQs = useQueries({
    queries: historyStatuses.map((st) => kycListQueryOptions(histFilters(st), wantKyc)),
  })
  const histKybQs = useQueries({
    queries: historyStatuses.map((st) => kybListQueryOptions(histFilters(st), wantKyb)),
  })

  const kycPendingItems: KycListItem[] = wantKyc ? (pendingKyc.data?.data ?? []) : []
  const kybPendingItems: KybListItem[] = wantKyb ? (pendingKyb.data?.data ?? []) : []
  const kycHistItems: KycListItem[] = wantKyc ? histKycQs.flatMap((q) => q.data?.data ?? []) : []
  const kybHistItems: KybListItem[] = wantKyb ? histKybQs.flatMap((q) => q.data?.data ?? []) : []

  const pendingRows = mergeBySubmitted(
    [...kycPendingItems.map(fromKyc), ...kybPendingItems.map(fromKyb)],
    'asc',
  )
  const historyRows = mergeBySubmitted(
    [...kycHistItems.map(fromKyc), ...kybHistItems.map(fromKyb)],
    'desc',
  )

  const total = (q: { data?: { metadata: { total: number } } }, on: boolean) =>
    on ? (q.data?.metadata.total ?? 0) : 0
  const pendingTotal = total(pendingKyc, wantKyc) + total(pendingKyb, wantKyb)
  const histQs = [...(wantKyc ? histKycQs : []), ...(wantKyb ? histKybQs : [])]
  const histTotal = histQs.reduce((acc, q) => acc + (q.data?.metadata.total ?? 0), 0)
  const pageCount = Math.max(
    1,
    ...histQs.map((q) => Math.ceil((q.data?.metadata.total ?? 0) / HISTORY_PAGE_SIZE)),
  )

  const loading = (q: { isLoading: boolean }, on: boolean) => on && q.isLoading
  const failed = (q: { isError: boolean }, on: boolean) => on && q.isError

  function update(next: Record<string, string | null>) {
    const n = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(next)) {
      if (v) n.set(k, v)
      else n.delete(k)
    }
    setSp(n, { replace: true })
  }

  const qs = location.search
  const open = (r: VerificationRow, replace = false) =>
    navigate(`/verifikasi/${r.kind}/${encodeURIComponent(r.id)}${qs}`, { replace })
  const close = () => navigate(`/verifikasi${qs}`)

  const selectedKey = selectedKind && selectedId ? `${selectedKind}:${selectedId}` : null
  // ↑/↓ mengikuti urutan yang TERLIHAT: menunggu dulu, lalu riwayat.
  const visibleRows = [...pendingRows, ...historyRows]
  const selectedIndex = selectedKey ? visibleRows.findIndex((r) => r.key === selectedKey) : -1
  const prevRow = selectedIndex > 0 ? visibleRows[selectedIndex - 1] : undefined
  const nextRow = selectedIndex >= 0 ? visibleRows[selectedIndex + 1] : undefined
  const nav = {
    index: selectedIndex >= 0 ? selectedIndex : null,
    total: visibleRows.length,
    onPrev: prevRow ? () => open(prevRow, true) : undefined,
    onNext: nextRow ? () => open(nextRow, true) : undefined,
  }

  const columns: GroupedColumn<VerificationRow>[] = [
    {
      id: 'submittedAt',
      header: 'Diajukan',
      className: 'hidden w-28 md:table-cell',
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {r.submittedAt ? formatShortDate(r.submittedAt) : '—'}
        </span>
      ),
    },
    {
      id: 'kind',
      header: 'Jenis',
      className: 'hidden w-28 sm:table-cell',
      cell: (r) => <span className="text-muted-foreground">{VERIFICATION_KIND_LABEL[r.kind]}</span>,
    },
    {
      id: 'name',
      header: 'Nasabah',
      cell: (r) => (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-semibold">{r.name}</span>
          {r.name !== r.email && <span className="text-xs text-muted-foreground">{r.email}</span>}
          {/* Kolom Jenis disembunyikan di ponsel — isinya pindah ke sini. */}
          <span className="mt-0.5 text-xs text-muted-foreground sm:hidden">{VERIFICATION_KIND_LABEL[r.kind]}</span>
        </div>
      ),
    },
    {
      id: 'submissionCount',
      header: 'Pengajuan ke-',
      className: 'hidden w-28 lg:table-cell',
      cell: (r) => <span className="tabular-nums">{r.submissionCount}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-36 sm:w-40',
      cell: (r) => {
        const s = verificationStatus(r.status)
        return <ToneChip tone={s.tone}>{s.label}</ToneChip>
      },
    },
  ]

  const list = (
    <div className="space-y-3">
      <TableToolbar
        search={{
          value: search,
          placeholder: 'Cari email, atau nama badan usaha',
          ariaLabel: 'Cari berkas verifikasi',
          onChange: (next) => update({ search: next.trim() || null, page: null }),
        }}
        extra={
          <>
            <Select
              value={jenis ?? SEMUA}
              onValueChange={(v) => update({ jenis: v === SEMUA ? null : v, page: null })}
            >
              <SelectTrigger aria-label="Jenis" className="h-9 w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua jenis</SelectItem>
                <SelectItem value="perorangan">Perorangan</SelectItem>
                <SelectItem value="badan-usaha">Badan usaha</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={history === 'REJECTED' ? 'ditolak' : history === 'VERIFIED' ? 'disetujui' : SEMUA}
              onValueChange={(v) => update({ riwayat: v === SEMUA ? null : v, page: null })}
            >
              <SelectTrigger aria-label="Riwayat" className="h-9 w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Riwayat: semua keputusan</SelectItem>
                <SelectItem value="disetujui">Riwayat: disetujui</SelectItem>
                <SelectItem value="ditolak">Riwayat: ditolak</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <GroupedTable
        columns={columns}
        rowKey={(r) => r.key}
        rowLabel={(r) => `Buka berkas ${VERIFICATION_KIND_LABEL[r.kind].toLowerCase()} ${r.name}`}
        selectedKey={selectedKey}
        onSelect={(r) => open(r)}
        groups={[
          {
            key: 'pending',
            label: 'Menunggu verifikasi',
            emphasis: true,
            rows: pendingRows,
            total: pendingTotal,
            isLoading: loading(pendingKyc, wantKyc) || loading(pendingKyb, wantKyb),
            isError: failed(pendingKyc, wantKyc) || failed(pendingKyb, wantKyb),
            onRetry: () => {
              if (wantKyc) pendingKyc.refetch()
              if (wantKyb) pendingKyb.refetch()
            },
            note:
              pendingTotal > pendingRows.length
                ? `${pendingRows.length} terlama ditampilkan — cari email untuk menemukan sisanya`
                : undefined,
          },
          {
            key: 'history',
            label:
              history === 'REJECTED' ? 'Ditolak' : history === 'VERIFIED' ? 'Sudah disetujui' : 'Sudah diputuskan',
            rows: historyRows,
            total: histTotal,
            isLoading: histQs.some((q) => q.isLoading),
            isError: histQs.some((q) => q.isError),
            onRetry: () => histQs.forEach((q) => q.refetch()),
            note:
              historyStatuses.length > 1 || (wantKyc && wantKyb)
                ? 'per halaman, terbaru dulu'
                : undefined,
            emptyText: search
              ? 'Tidak ada yang cocok. Coba email lain.'
              : history === 'REJECTED'
                ? 'Belum ada berkas yang ditolak.'
                : history === 'VERIFIED'
                  ? 'Belum ada berkas yang disetujui.'
                  : 'Belum ada berkas yang diputuskan.',
            pagination: { page, pageCount, onPage: (p) => update({ page: p > 1 ? String(p) : null }) },
          },
        ]}
      />
    </div>
  )

  const rawKyc =
    selectedKind === 'perorangan'
      ? (kycPendingItems.concat(kycHistItems).find((k) => k.id === selectedId) ?? null)
      : null
  const rawKyb =
    selectedKind === 'badan-usaha'
      ? (kybPendingItems.concat(kybHistItems).find((k) => k.id === selectedId) ?? null)
      : null

  return (
    <div>
      <PageHeader
        title="Verifikasi"
        subtitle="Berkas perorangan dan badan usaha. Yang menunggu diperiksa ada di paling atas, terlama dulu."
        actions={
          canReviewKyc(user) ? (
            <Button size="sm" variant="outline" onClick={() => navigate('/kyb/new')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Tambah berkas badan usaha
            </Button>
          ) : undefined
        }
      />
      {list}
      <KycDetailModal
        kycId={selectedKind === 'perorangan' ? selectedId : null}
        listItem={rawKyc}
        open={selectedKind === 'perorangan' && Boolean(selectedId)}
        onOpenChange={(o) => {
          if (!o) close()
        }}
        nav={selectedKind === 'perorangan' ? nav : null}
      />
      <KybDetailModal
        kybId={selectedKind === 'badan-usaha' ? selectedId : null}
        listItem={rawKyb}
        open={selectedKind === 'badan-usaha' && Boolean(selectedId)}
        onOpenChange={(o) => {
          if (!o) close()
        }}
        nav={selectedKind === 'badan-usaha' ? nav : null}
      />
    </div>
  )
}
