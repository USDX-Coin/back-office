import { useNavigate, useParams } from 'react-router'
import { ArrowRightLeft } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import TableToolbar from '@/components/table/TableToolbar'
import PeringatanRentang from '@/components/table/PeringatanRentang'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { useDataTableParams } from '@/components/useDataTableParams'
import { rowNav, useReturnFocusToRow } from '@/components/record-modal/rowNav'
import { formatDateTime } from '@/lib/format'
import { isMintSwapStatus, mintSwapStatusPill } from '@/lib/mintSwaps'
import { formatUsdxExact } from '@/lib/redeemApprovals'
import { periksaRentangWib } from '@/lib/wibRange'
import type { MintSwapListItem } from '@/lib/types'
import MintSwapDetailModal from './MintSwapDetailModal'
import { mintSwapColumns } from './columns'
import { MINT_SWAP_COLUMN_CONFIG, MINT_SWAP_FILTER_DEFS } from './filterDefs'
import { useMintSwaps } from './hooks'

const PAGE_SIZE = 20
const BASE = '/swap-idr-usd'

/**
 * D29 — "Swap IDR→USD" (`sot/bni-integration.md § 21.9`, `GET /api/v1/mint-swaps`).
 *
 * Semua swap per order mint VA, terbaru dulu (urutan server), saringan status +
 * tanggal masuk antrean (WIB). Klik baris = riwayat lengkap satu transaksi.
 * Terbuka untuk semua peran; aksi hanya di detail swap `NEEDS_ACTION`.
 */
export default function MintSwapsPage() {
  const navigate = useNavigate()
  const { id: activeId } = useParams<{ id?: string }>()
  const params = useDataTableParams()

  const rawStatus = params.searchParams.get('status') ?? ''
  const status = isMintSwapStatus(rawStatus) ? rawStatus : undefined
  const from = (params.searchParams.get('from') ?? '').trim()
  const to = (params.searchParams.get('to') ?? '').trim()
  // Rentang dari URL yang tidak sah tidak dikirim — dan halamannya mengatakannya.
  const rentang = periksaRentangWib(from, to)
  const list = useMintSwaps({
    page: params.page,
    take: PAGE_SIZE,
    status,
    ...(rentang.sah ? { from: from || undefined, to: to || undefined } : {}),
  })
  const [colVisibility, setColVisibility] = useColumnVisibility('mint-swaps', MINT_SWAP_COLUMN_CONFIG)

  const rows = list.data?.data ?? []
  const suffix = params.searchParams.toString() ? `?${params.searchParams}` : ''
  const openDetail = (id: string) => navigate(`${BASE}/${id}${suffix}`)
  const returnFocus = useReturnFocusToRow(activeId)

  return (
    <div>
      <PageHeader
        title="Swap IDR→USD"
        subtitle="Setiap order mint lewat payment gateway ditukar ke dolar sebelum USDX dicetak. Klik baris untuk melihat riwayat lengkap transaksinya."
      />
      <DataTable<MintSwapListItem>
        columns={mintSwapColumns(openDetail)}
        data={rows}
        rowCount={list.data?.metadata.total ?? 0}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        getRowId={(r) => r.id}
        filterToolbar={
          <div className="space-y-2">
            <PeringatanRentang masalah={rentang.masalah} layar="mint-swaps" />
            <TableToolbar
              filter={{
                defs: MINT_SWAP_FILTER_DEFS,
                values: { status: status ?? '', from, to },
                onChange: (next) =>
                  params.updateParams({
                    status: next.status || null,
                    from: next.from || null,
                    to: next.to || null,
                    page: '1',
                  }),
              }}
              columns={{ items: MINT_SWAP_COLUMN_CONFIG, visibility: colVisibility, onChange: setColVisibility }}
            />
          </div>
        }
        hasFilters={Boolean(status || from || to)}
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={<ArrowRightLeft className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Belum ada swap"
            description="Swap lahir saat order mint lewat payment gateway dibayar. Kosong berarti belum ada order seperti itu, atau swap sedang dimatikan di server."
          />
        }
        onRowClick={(r) => openDetail(r.id)}
        rowAriaLabel={(r) =>
          `Swap ${r.customerName ?? 'nasabah'} ${formatUsdxExact(r.amountUsdx)}, ${mintSwapStatusPill(r.status).label}, masuk ${formatDateTime(r.queuedAt)}`
        }
      />
      <MintSwapDetailModal
        swapId={activeId ?? null}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) navigate(`${BASE}${suffix}`, { replace: true })
        }}
        nav={rowNav(rows, (r) => r.id, activeId, (id) => navigate(`${BASE}/${id}${suffix}`, { replace: true }))}
        returnFocusTo={returnFocus}
      />
    </div>
  )
}
