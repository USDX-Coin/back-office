import { useNavigate, useParams } from 'react-router'
import PeringatanRentang from '@/components/table/PeringatanRentang'
import { periksaRentangWib } from '@/lib/wibRange'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, RadioTower } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import StatusPill from '@/components/StatusPill'
import { TableCellText } from '@/components/ui/table'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import {
  durianpayCallLabel,
  durianpayOutcomeView,
  formatCallDuration,
  hasDurianpayFilter,
  toDurianpayApiCallQuery,
  type DurianpayApiCallFilterValues,
} from '@/lib/durianpayApiCalls'
import { formatDateTime } from '@/lib/format'
import type { DurianpayApiCallListItem } from '@/lib/types'
import DurianpayApiCallDetailModal from './DurianpayApiCallDetailModal'
import { DURIANPAY_CALL_COLUMN_CONFIG, DURIANPAY_CALL_FILTER_DEFS } from './filterDefs'
import { useDurianpayApiCalls } from './hooks'

const PAGE_SIZE = 20

/** Urutan kunci = urutan `DURIANPAY_CALL_FILTER_DEFS`; keduanya menulis URL yang sama. */
const FILTER_KEYS: (keyof DurianpayApiCallFilterValues)[] = [
  'from',
  'to',
  'outcome',
  'apiFlavor',
  'path',
  'referenceNo',
  'httpStatus',
  'responseCode',
]

/**
 * Log Panggilan DurianPay — jejak SETIAP panggilan yang kita kirim ke DurianPay.
 *
 * KENAPA LAYAR INI ADA: sampai tabelnya lahir, arah KELUAR tidak punya catatan
 * apa pun. `create-va` production yang gagal `5002701` pada 5–7 Sep 2026 tidak
 * meninggalkan request, responseCode, maupun trace_id yang bisa dibaca ulang —
 * dashboard DurianPay tidak menyimpan rinciannya dan Grafana internal tidak bisa
 * dibuka dari luar. Data itu kini ADA di database; layar ini yang membuatnya bisa
 * dilihat orang.
 *
 * PEMBACANYA OPERATOR, BUKAN ENGINEER, dan itu yang membentuk kolomnya. Lima
 * kolom pertama menjawab kapan, apa yang dipanggil, berhasil atau tidak, kenapa
 * gagal, dan order mana — tanpa satu pun istilah SNAP. Yang teknis tidak dibuang,
 * hanya dipindah: badan pesan mentah ada di "Detail teknis" yang bisa dibuka di
 * modal detail, kode angka DurianPay tetap tampil apa adanya di samping
 * keterangan bahasanya.
 *
 * Read-only seluruhnya — modulnya backend hanya punya dua GET, tidak ada satu pun
 * aksi. Peran: MANAGER / ADMIN / DEVELOPER (STAFF ditolak 403), digerbangi di
 * menu DAN di rutenya.
 */
export default function DurianpayApiCallsPage() {
  const navigate = useNavigate()
  // `/durianpay-api-calls/:id` merender ulang daftar dan membuka detailnya
  // (pola /payout-failures dan /screening).
  const { id: activeId } = useParams<{ id?: string }>()

  const params = useDataTableParams()
  const filterValues = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, params.searchParams.get(key) ?? '']),
  ) as unknown as DurianpayApiCallFilterValues

  // Nilai URL yang tidak dikenal kontrak dibuang di sini, bukan dikirim: server
  // akan menjawab 400 dan tabelnya terlihat gagal dimuat karena sebuah tautan basi.
  const query = toDurianpayApiCallQuery(filterValues, params.page, PAGE_SIZE)
  const rentang = periksaRentangWib(filterValues.from.trim(), filterValues.to.trim())
  const list = useDurianpayApiCalls(query)

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'durianpay-api-calls',
    DURIANPAY_CALL_COLUMN_CONFIG,
  )

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0

  // Saringan & halaman ikut ke URL detail dan kembali saat modal ditutup.
  const suffix = params.searchParams.toString() ? `?${params.searchParams}` : ''
  const openDetail = (id: string) => navigate(`/durianpay-api-calls/${id}${suffix}`)

  const columns: ColumnDef<DurianpayApiCallListItem>[] = [
    {
      id: 'requestedAt',
      header: 'Waktu (WIB)',
      // `12 Sep 2026, 08:00:37` butuh ±140px; tanpa `size` kolomnya dapat
      // 120px bawaan dan detiknya terpotong. "WIB" cukup di judul kolom.
      size: 192,
      cell: ({ row }) => (
        <TableCellText
          value={formatDateTime(row.original.requestedAt)}
          className="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
        />
      ),
    },
    {
      id: 'call',
      size: 288,
      header: 'Panggilan',
      cell: ({ row }) => {
        const { path, httpMethod } = row.original
        const label = durianpayCallLabel(path)
        return (
          <div className="flex min-w-0 max-w-[18rem] flex-col gap-0.5">
            {/* Path tak dikenal dirender sebagai pathnya sendiri — tanpa arti karangan. */}
            <span className="truncate text-xs font-medium" title={path}>
              {label ?? path}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground" title={path}>
              {httpMethod} {path}
            </span>
          </div>
        )
      },
    },
    {
      id: 'outcome',
      size: 168,
      header: 'Hasil',
      cell: ({ row }) => {
        const { outcome, errorSummary, httpStatus } = row.original
        const view = durianpayOutcomeView(outcome, errorSummary)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <StatusPill cfg={view.pill} className="w-fit whitespace-nowrap" />
            <span className="text-xs tabular-nums text-muted-foreground">
              {/* `null` di sini berarti TIDAK ADA respons sama sekali — timeout atau
                  jaringan — bukan nilai yang gagal dimuat. Em dash akan terbaca salah. */}
              {httpStatus === null ? 'tanpa jawaban' : `HTTP ${httpStatus}`}
            </span>
          </div>
        )
      },
    },
    {
      id: 'cause',
      size: 240,
      header: 'Kenapa',
      cell: ({ row }) => {
        const { errorSummary } = row.original
        if (!errorSummary) return <span className="text-muted-foreground">—</span>
        return (
          <span
            className="line-clamp-2 max-w-[14rem] text-xs text-foreground"
            title={errorSummary}
          >
            {errorSummary}
          </span>
        )
      },
    },
    {
      id: 'reference',
      size: 176,
      header: 'Order',
      cell: ({ row }) => {
        const { referenceNo } = row.original
        if (!referenceNo) {
          return (
            <span
              className="whitespace-nowrap text-xs text-muted-foreground"
              title="Sebagian panggilan memang tidak membawa referensi order — mis. ambil token akses dan cek saldo."
            >
              tanpa nomor order
            </span>
          )
        }
        // PENUH, tidak dipotong dan tidak dipatahkan di tengah: ini nilai yang
        // dicocokkan ops dengan ordernya, dan `MNT7K2X9QP` yang jatuh jadi tiga
        // baris tidak bisa dibaca sekilas. Kolomnya karena itu diberi lebar
        // sendiri (di bawah), dan referensi yang tetap lebih panjang terbaca
        // utuh lewat `title` — bukan hilang diam-diam di tepi sel.
        return (
          <TableCellText
            value={referenceNo}
            className="whitespace-nowrap font-mono text-xs tabular-nums"
          />
        )
      },
    },
    {
      id: 'duration',
      size: 104,
      header: 'Lama',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs tabular-nums">
          {formatCallDuration(row.original.durationMs)}
        </span>
      ),
    },
    {
      id: 'flavor',
      size: 120,
      header: 'Integrasi',
      cell: ({ row }) => (
        <span className="tabular-nums text-xs text-muted-foreground">
          {row.original.apiFlavor}
        </span>
      ),
    },
    {
      id: 'actions',
      size: 96,
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openDetail(row.original.id)
          }}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 text-label font-medium text-primary transition-colors hover:bg-muted"
          aria-label={`Buka detail panggilan ${row.original.httpMethod} ${row.original.path}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Detail
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Log DurianPay"
        subtitle="Setiap panggilan yang kita kirim ke DurianPay — berhasil maupun gagal, termasuk yang tidak pernah dijawab — beserta jawabannya. Halaman baca saja: tidak ada tombol di sini yang mengubah apa pun."
      />

      <DataTable<DurianpayApiCallListItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        filterToolbar={
          <div className="space-y-2">
            <PeringatanRentang masalah={rentang.masalah} layar="durianpay" />
          <TableToolbar
            filter={{
              defs: DURIANPAY_CALL_FILTER_DEFS,
              values: filterValues as unknown as Record<string, string>,
              onChange: (next) =>
                params.updateParams({
                  ...Object.fromEntries(FILTER_KEYS.map((key) => [key, next[key] || null])),
                  page: '1',
                }),
            }}
            columns={{
              items: DURIANPAY_CALL_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
          </div>
        }
        hasFilters={hasDurianpayFilter(query)}
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={<RadioTower className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Belum ada panggilan tercatat"
            description="Jejak ditulis satu baris per panggilan keluar, sukses maupun gagal. Kosong berarti belum ada panggilan sejak pencatatnya aktif — atau barisnya sudah lewat masa simpan dan dibersihkan penyapu retensi."
          />
        }
        onRowClick={(r) => openDetail(r.id)}
        rowAriaLabel={(r) =>
          `Panggilan ${r.httpMethod} ${r.path} ${formatDateTime(r.requestedAt)}`
        }
      />

      <DurianpayApiCallDetailModal
        callId={activeId ?? null}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) navigate(`/durianpay-api-calls${suffix}`, { replace: true })
        }}
      />
    </div>
  )
}
