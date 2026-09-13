import { type ColumnDef } from '@tanstack/react-table'
import { BanknoteX } from 'lucide-react'
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
import { canResolvePayoutFailure, useAuth } from '@/lib/auth'
import { formatWibDateTime } from '@/lib/format'
import {
  formatQueueAge,
  isPayoutIssueKind,
  payoutIssueCodeLabel,
  payoutIssueKindPill,
} from '@/lib/payoutFailures'
import { formatIdrExact, formatUsdxExact } from '@/lib/redeemApprovals'
import type { PayoutFailureListItem } from '@/lib/types'
import { PAYOUT_FAILURE_COLUMN_CONFIG, PAYOUT_FAILURE_FILTER_DEFS } from './filterDefs'
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
  const total = list.data?.metadata.total ?? 0

  const columns: ColumnDef<PayoutFailureListItem>[] = [
    {
      id: 'issueAt',
      header: 'Masuk antrean',
      cell: ({ row }) => (
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
          {formatWibDateTime(row.original.issueAt)}
        </span>
      ),
    },
    {
      id: 'issue',
      header: 'Masalah',
      cell: ({ row }) => {
        const { issueKind: kind, issueCode } = row.original
        const codeLabel = payoutIssueCodeLabel(issueCode)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <StatusPill cfg={payoutIssueKindPill(kind)} className="w-fit" />
            {issueCode && (
              <span className="text-[11.5px] text-muted-foreground" title={issueCode}>
                {codeLabel ?? <span className="font-mono">{issueCode}</span>}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'amount',
      header: 'Nominal',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[13px] font-semibold tabular-nums">
            {formatIdrExact(row.original.netPayoutIdr)}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatUsdxExact(row.original.amountUsdx)}
          </span>
        </div>
      ),
    },
    {
      id: 'destination',
      header: 'Rekening tujuan',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="text-[12.5px]">{row.original.bankName}</span>
          {/* PENUH, tidak dipotong: nilai yang dicocokkan ops dengan keluhan nasabah. */}
          <span className="break-all font-mono text-[12px] tabular-nums">
            {row.original.bankAccountNumber}
          </span>
          <span className="truncate text-[11.5px] text-muted-foreground">
            {row.original.bankAccountName}
          </span>
        </div>
      ),
    },
    {
      id: 'owner',
      header: 'Pemilik order',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px]">{row.original.ownerLabel}</span>
          {row.original.ownerKind === 'PARTNER' && (
            // Order partner yang bermasalah dikejar ke PARTNER-nya, bukan ke nasabahnya.
            <span className="mt-0.5 w-fit rounded-sm bg-muted px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              Partner
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'age',
      header: 'Umur antrean',
      cell: ({ row }) => (
        <span className="font-mono text-[12px] tabular-nums">
          {formatQueueAge(row.original.issueAt)}
        </span>
      ),
    },
  ]

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <PageHeader
          eyebrow="Consumer"
          title="Pencairan Bermasalah"
          italicAccent="redeem"
          subtitle="Payout redeem yang gagal, burn yang ditolak, dan payout yang tertahan. USDX nasabah sudah terbakar dan rupiahnya belum sampai — setiap baris menunggu satu keputusan manusia."
          actions={
            canResolve ? undefined : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="rounded-sm bg-muted px-2 py-1 text-[11.5px] font-medium text-muted-foreground"
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
          rowAriaLabel={(r) => `Pencairan bermasalah ${r.bankAccountName} ${r.netPayoutIdr}`}
        />
      </div>
    </TooltipProvider>
  )
}
