import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, HandCoins } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import StatusPill from '@/components/StatusPill'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { formatIdrExact } from '@/lib/redeemApprovals'
import { canResolveHeldCredit } from './access'
import { HELD_CREDIT_COLUMN_CONFIG } from './filterDefs'
import HeldCreditDetailModal from './HeldCreditDetailModal'
import { useHeldCredits } from './hooks'
import {
  amountGapLabel,
  formatCreditAge,
  heldReasonLabel,
  receivedAmountLabel,
  sourcePill,
} from './labels'
import type { HeldCreditListItem } from './types'
import { UNKNOWN_CODE_LABEL } from '@/lib/status'

const PAGE_SIZE = 10

/**
 * Mint Bermasalah — antrean kredit masuk yang tak bisa dicocokkan
 * (`/api/v1/held-credits`, USDX-341/342, `sot/bni-integration.md § 6`).
 *
 * Tiap baris adalah uang nasabah yang SUDAH masuk rekening dan belum menjadi
 * USDX. Bentuk layarnya mengikuti dari itu:
 *
 *  - Terbuka untuk semua peran back office; yang digerbangi adalah
 *    MENYELESAIKAN (STAFF/MANAGER/ADMIN, DEVELOPER 403), di dalam detail.
 *  - Urutan terlama dulu adalah urutan server, dan tidak ada saringan sama
 *    sekali — `ListHeldCreditsDto` cuma menerima `page` + `take`. Toolbar tetap
 *    dipasang supaya `DataTable` tidak merender kotak Search + isian tanggal
 *    bawaannya, yang akan menulis parameter yang endpoint ini abaikan.
 *  - Nominal yang masuk dirender PENUH, termasuk saat ia bukan rupiah bulat.
 *    Nilai ganjil itu justru yang paling sering jadi sebab kredit tertahan.
 *
 * Tempatnya di menu sudah dipesan sejak perombakan navigasi: berdampingan
 * dengan "Pencairan Bermasalah" (keputusan PM 2026-09-13, § 17.9) — dua antrean
 * penyelesaian uang duduk bersebelahan.
 */
export default function HeldCreditsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: activeId } = useParams<{ id?: string }>()
  const params = useDataTableParams()

  const list = useHeldCredits({ page: params.page, take: PAGE_SIZE })
  const [colVisibility, setColVisibility] = useColumnVisibility(
    'held-credits',
    HELD_CREDIT_COLUMN_CONFIG
  )

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  const query = params.searchParams.toString()
  const suffix = query ? `?${query}` : ''
  const openDetail = (id: string) => navigate(`/mint-bermasalah/${id}${suffix}`)

  const columns: ColumnDef<HeldCreditListItem>[] = [
    {
      id: 'receivedAt',
      header: 'Uang masuk (WIB)',
      // Cukup untuk `12 Sep 2026, 08:00:09` UTUH (detik ikut) — ini stempel
      // waktu yang dicocokkan ops dengan rekening koran bank.
      size: 168,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDateTime(row.original.receivedAt)}
        </span>
      ),
    },
    {
      id: 'problem',
      header: 'Kenapa tertahan',
      size: 208,
      cell: ({ row }) => {
        const { heldReason, source } = row.original
        const label = heldReasonLabel(heldReason)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <StatusPill cfg={sourcePill(source)} className="w-fit" />
            {heldReason && (
              <span
                className="truncate text-xs text-muted-foreground"
                // Terjemahan DAN kode mesinnya, dua-duanya. Kode itu yang
                // dikutip ke tim teknis; terjemahannya yang dibaca operator.
                title={label ? `${label} (${heldReason})` : heldReason}
              >
                {label ?? UNKNOWN_CODE_LABEL}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'amount',
      header: 'Nominal masuk',
      size: 176,
      cell: ({ row }) => {
        const gap = amountGapLabel(row.original)
        return (
          <div className="flex min-w-0 flex-col">
            {/* `title` memuat nominal UTUH: kolomnya cukup untuk nominal sehari-hari,
                tapi uang masuk yang luar biasa besar tidak boleh terbaca separuh. */}
            <span
              className="truncate text-sm font-semibold tabular-nums"
              title={receivedAmountLabel(row.original)}
            >
              {receivedAmountLabel(row.original)}
            </span>
            {gap && (
              <span
                className="truncate text-xs tabular-nums text-warning"
                title={gap}
              >
                {gap}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'payer',
      header: 'Pengirim',
      // Nomor rekening pengirim — nilai yang dicocokkan ops dengan mutasi bank.
      // 144px hanya memuat 120px isi; nomor 16 digit mono tidak muat.
      size: 176,
      cell: ({ row }) => {
        const { senderName, accountFromTo } = row.original
        if (!senderName && !accountFromTo) {
          return <span className="text-xs text-muted-foreground">tidak disebut penyedia</span>
        }
        return (
          <div className="flex min-w-0 flex-col">
            {senderName && (
              <span className="truncate text-xs" title={senderName}>
                {senderName}
              </span>
            )}
            {accountFromTo && (
              <span
                className="truncate text-xs tabular-nums text-muted-foreground"
                title={accountFromTo}
              >
                {accountFromTo}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'order',
      header: 'Order pilihan mesin',
      // Baris keduanya berbunyi "ditagihkan Rp 4.012.350,00" — kata + nominal
      // dalam satu baris, jadi lebarnya harus memuat keduanya. 184px memotong
      // justru ujung nominalnya.
      size: 208,
      cell: ({ row }) => {
        const order = row.original.order
        if (!order) {
          return (
            <span className="text-xs text-muted-foreground">Tidak ada — ops menentukan</span>
          )
        }
        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs">{order.customerName}</span>
            {order.expectedAmountIdr && (
              <span
                className="truncate text-xs tabular-nums text-muted-foreground"
                title={`Ditagihkan ${formatIdrExact(order.expectedAmountIdr)}`}
              >
                ditagihkan {formatIdrExact(order.expectedAmountIdr)}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'age',
      header: 'Umur antrean',
      size: 112,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatCreditAge(row.original.receivedAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openDetail(row.original.id)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label font-medium text-primary transition-colors hover:bg-muted"
          aria-label={`Buka detail kredit ${receivedAmountLabel(row.original)}`}
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
          title="Mint Bermasalah"
          subtitle="Uang nasabah sudah masuk rekening dan mesin tidak bisa memastikan ia melunasi order yang mana. Setiap baris menunggu satu keputusan manusia: diterima dan dilekatkan ke ordernya, atau ditolak."
          actions={
            canResolveHeldCredit(user) ? undefined : (
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
                  Menyelesaikan kredit tertahan tertutup untuk Developer — server menolaknya
                  dengan 403
                </TooltipContent>
              </Tooltip>
            )
          }
        />

        <DataTable<HeldCreditListItem>
          columns={columns}
          data={rows}
          rowCount={total}
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          pageSize={PAGE_SIZE}
          columnVisibility={colVisibility}
          onColumnVisibilityChange={setColVisibility}
          getRowId={(row) => row.id}
          filterToolbar={
            <TableToolbar
              columns={{
                items: HELD_CREDIT_COLUMN_CONFIG,
                visibility: colVisibility,
                onChange: setColVisibility,
              }}
            />
          }
          hasFilters={false}
          emptyState={
            <TableEmptyState
              mode="no-data"
              icon={<HandCoins className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
              title="Tidak ada mint bermasalah"
              description="Semua uang masuk berhasil dicocokkan ke ordernya. Kredit yang sudah dituntaskan keluar dari daftar ini."
            />
          }
          onRowClick={(row) => openDetail(row.id)}
          rowAriaLabel={(row) =>
            `Kredit tertahan ${receivedAmountLabel(row)} ${formatDateTime(row.receivedAt)}`
          }
        />

        <HeldCreditDetailModal
          creditId={activeId ?? null}
          open={Boolean(activeId)}
          onOpenChange={(open) => {
            if (!open) navigate(`/mint-bermasalah${suffix}`, { replace: true })
          }}
        />
      </div>
    </TooltipProvider>
  )
}
