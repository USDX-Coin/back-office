import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { BanknoteX, Eye } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import StatusPill from '@/components/StatusPill'
import { UNKNOWN_CODE_LABEL } from '@/lib/status'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import TableToolbar from '@/components/table/TableToolbar'
import { TableCellStack } from '@/components/ui/table'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { canResolvePayoutFailure, useAuth } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import {
  formatQueueAge,
  isPayoutIssueKind,
  payoutIssueCodeLabel,
  payoutIssueKindPill,
} from '@/lib/payoutFailures'
import { formatIdrExact, formatUsdxExact } from '@/lib/redeemApprovals'
import type { PayoutFailureListItem } from '@/lib/types'
import { PAYOUT_FAILURE_COLUMN_CONFIG, PAYOUT_FAILURE_FILTER_DEFS } from './filterDefs'
import PayoutFailureDetailModal from './PayoutFailureDetailModal'
import { usePayoutFailures } from './hooks'

const PAGE_SIZE = 10

/**
 * USDX-662 — antrean "Pencairan Bermasalah" (`sot/bni-integration.md § 17.9`).
 *
 * Setiap baris adalah nasabah yang USDX-nya sudah terbakar permanen dan rupiahnya
 * belum sampai. Bentuk layarnya mengikuti dari itu:
 *
 *  - Terbuka untuk SEMUA peran back office (server: STAFF / MANAGER / ADMIN /
 *    DEVELOPER); yang digerbangi MANAGER/ADMIN adalah aksi resolve di detail,
 *    bukan halamannya. Tidak ada `RoleGuard` di rutenya.
 *  - Nomor rekening + nama pemilik menurut bank dirender PENUH di tabel — itu
 *    yang ops nilai. Email nasabah di `ownerLabel` sudah dipresentasikan server
 *    sesuai role (ter-mask selain ADMIN), jadi dirender apa adanya.
 *  - Urutan TERLAMA dulu adalah urutan server; satu-satunya kendali adalah filter
 *    `issueKind`, karena hanya itu yang diterima kontraknya.
 */
export default function PayoutFailuresPage() {
  const { user } = useAuth()
  const canResolve = canResolvePayoutFailure(user)
  const navigate = useNavigate()
  // `/payout-failures/:id` merender ulang antrean dan membuka detailnya (pola /screening).
  const { id: activeId } = useParams<{ id?: string }>()

  const params = useDataTableParams()
  const rawKind = params.searchParams.get('issueKind') ?? ''
  // Nilai URL yang bukan jenis kontrak tidak dikirim — server akan menjawab 400,
  // dan tautan basi tidak boleh membuat antrean terlihat gagal dimuat.
  const issueKind = isPayoutIssueKind(rawKind) ? rawKind : undefined
  const list = usePayoutFailures({ page: params.page, take: PAGE_SIZE, issueKind })

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'payout-failures',
    PAYOUT_FAILURE_COLUMN_CONFIG,
  )

  const rows = list.data?.data ?? []
  // Filter & halaman ikut ke URL detail dan kembali saat modal ditutup — ops yang
  // menuntaskan antrean BURN_REJECTED satu per satu tidak boleh terlempar ke semua jenis.
  const query = params.searchParams.toString()
  const suffix = query ? `?${query}` : ''
  const openDetail = (id: string) => navigate(`/payout-failures/${id}${suffix}`)
  const total = list.data?.metadata.total ?? 0

  const columns: ColumnDef<PayoutFailureListItem>[] = [
    {
      id: 'issueAt',
      // Cap waktu ditulis penuh sampai detik ("12 Sep 2026, 08:00:09"); zona
      // ditulis sekali di judul kolom. Detik itu yang dicocokkan ops dengan
      // mutasi bank, jadi lebarnya dijaga.
      size: 184,
      header: 'Masuk antrean (WIB)',
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDateTime(row.original.issueAt)}
        </span>
      ),
    },
    {
      id: 'issue',
      size: 208,
      header: 'Masalah',
      cell: ({ row }) => {
        const { issueKind: kind, issueCode } = row.original
        const codeLabel = payoutIssueCodeLabel(issueCode)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <StatusPill cfg={payoutIssueKindPill(kind)} className="w-fit" />
            {issueCode && (
              // `title` memuat kalimat UTUH plus kodenya: keterangan masalah
              // dalam bahasa Indonesia lebih panjang dari lebar kolom dan
              // terpotong elipsis, dan dulu hover hanya memunculkan kodenya —
              // jadi kalimat yang terpotong tidak bisa dibaca di mana pun.
              <span
                className="truncate text-xs text-muted-foreground"
                title={codeLabel ? `${codeLabel} (${issueCode})` : issueCode}
              >
                {codeLabel ?? UNKNOWN_CODE_LABEL}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'amount',
      // RUPIAH YANG AKAN DIKIRIM ULANG KE NASABAH — sel paling mahal di layar ini.
      //
      // Tanpa `size` kolomnya dapat angka bawaan 120px, yang setelah padding sel
      // menyisakan 96px isi. "Rp 4.012.350,00" butuh ±126px, jadi ia terpotong —
      // dan karena isinya kotak BLOK, `text-overflow` di `td` tidak berlaku, jadi
      // terpotongnya TANPA TANDA: "Rp 4.012.350,0". 184px memuat bentuk terpanjang
      // yang realistis ("Rp 999.999.999,00" ≈ 143px + 24px padding), dan nominal
      // di atas itu pun tetap terbaca utuh lewat `title`/tooltip `TableCellStack`.
      size: 184,
      header: 'Nominal',
      cell: ({ row }) => (
        <TableCellStack
          lines={[
            {
              value: formatIdrExact(row.original.netPayoutIdr),
              className: 'text-sm font-semibold tabular-nums',
            },
            {
              value: formatUsdxExact(row.original.amountUsdx),
              className: 'text-xs tabular-nums text-muted-foreground',
            },
          ]}
        />
      ),
    },
    {
      id: 'destination',
      // Nomor rekening: nilai yang dicocokkan ops dengan keluhan nasabah, jadi
      // ia harus terbaca UTUH. Dulu itu dijamin `break-all` (nomornya turun
      // baris daripada terpotong); kelas itu dibuang saat sel dipaksa satu
      // baris, dan tidak ada penggantinya — nomornya lalu terpotong diam-diam.
      // Sekarang dua-duanya: lebar yang memuat nomor terpanjang (BNI 10 digit,
      // bank lain sampai 16) DAN nilai utuh di `title`.
      size: 208,
      header: 'Rekening tujuan',
      cell: ({ row }) => (
        <TableCellStack
          lines={[
            { value: row.original.bankName, className: 'text-xs' },
            {
              value: row.original.bankAccountNumber,
              className: 'text-xs tabular-nums',
            },
            {
              value: row.original.bankAccountName,
              className: 'text-xs text-muted-foreground',
            },
          ]}
        />
      ),
    },
    {
      id: 'owner',
      size: 168,
      header: 'Pemilik order',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs" title={row.original.ownerLabel}>
            {row.original.ownerLabel}
          </span>
          {row.original.ownerKind === 'PARTNER' && (
            // Order partner yang bermasalah dikejar ke PARTNER-nya, bukan ke nasabahnya.
            <span className="mt-0.5 w-fit rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              Partner
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'age',
      size: 120,
      header: 'Umur antrean',
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatQueueAge(row.original.issueAt)}
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
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label font-medium text-primary transition-colors hover:bg-muted"
          aria-label={`Buka detail pencairan ${row.original.bankAccountName}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Detail
        </button>
      ),
    },
  ]

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <PageHeader
          title="Pencairan Bermasalah"
          subtitle="Payout redeem yang gagal, burn yang ditolak, dan payout yang tertahan. USDX nasabah sudah terbakar dan rupiahnya belum sampai — setiap baris menunggu satu keputusan manusia."
          actions={
            canResolve ? undefined : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="rounded-sm bg-muted px-2 py-1 text-label font-medium text-muted-foreground"
                  >
                    Hanya bisa melihat
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Menuntaskan pencairan bermasalah hanya untuk Manager dan Admin — server
                  menolak peran lain dengan 403
                </TooltipContent>
              </Tooltip>
            )
          }
        />

        <DataTable<PayoutFailureListItem>
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
            <TableToolbar
              filter={{
                defs: PAYOUT_FAILURE_FILTER_DEFS,
                values: { issueKind: issueKind ?? '' },
                onChange: (next) =>
                  params.updateParams({ issueKind: next.issueKind || null, page: '1' }),
              }}
              columns={{
                items: PAYOUT_FAILURE_COLUMN_CONFIG,
                visibility: colVisibility,
                onChange: setColVisibility,
              }}
            />
          }
          hasFilters={Boolean(issueKind)}
          emptyState={
            <TableEmptyState
              mode="no-data"
              icon={<BanknoteX className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
              title="Tidak ada pencairan bermasalah"
              description="Antrean kosong berarti tidak ada payout yang gagal, burn yang ditolak, atau payout yang tertahan menunggu keputusan. Order yang sudah dituntaskan keluar dari daftar ini."
            />
          }
          onRowClick={(r) => openDetail(r.id)}
          rowAriaLabel={(r) => `Pencairan bermasalah ${r.bankAccountName} ${r.netPayoutIdr}`}
        />

        <PayoutFailureDetailModal
          orderId={activeId ?? null}
          open={Boolean(activeId)}
          onOpenChange={(o) => {
            if (!o) navigate(`/payout-failures${suffix}`, { replace: true })
          }}
        />
      </div>
    </TooltipProvider>
  )
}
