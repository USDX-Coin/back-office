import { useNavigate, useParams } from 'react-router'
import { CheckCircle2 } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { useDataTableParams } from '@/components/useDataTableParams'
import { rowNav, useReturnFocusToRow } from '@/components/record-modal/rowNav'
import { canResolveMintSwap, useAuth } from '@/lib/auth'
import { formatWaiting, mintSwapIssueLabel } from '@/lib/mintSwaps'
import { formatUsdxExact } from '@/lib/redeemApprovals'
import type { MintSwapListItem } from '@/lib/types'
import MintSwapDetailModal from './MintSwapDetailModal'
import { mintSwapIssueColumns } from './columns'
import { MINT_SWAP_ISSUE_COLUMN_CONFIG } from './filterDefs'
import { useMintSwaps, usePendingSettledManual } from './hooks'

const PAGE_SIZE = 20
const BASE = '/swap-bermasalah'

/**
 * D29 — antrean "Swap Bermasalah" (`sot/bni-integration.md § 21.6`): swap
 * `NEEDS_ACTION`, terlama dulu (urutan server untuk status ini). Satu layar untuk
 * satu keputusan: alasan dalam kalimat, nominal, waktu menunggu, riwayat, dan HANYA
 * tombol yang sah. Badge sidebar = `queue-counts.mintSwapIssuesOpen`.
 */
export default function MintSwapIssuesPage() {
  const { user } = useAuth()
  const canResolve = canResolveMintSwap(user)
  const navigate = useNavigate()
  const { id: activeId } = useParams<{ id?: string }>()
  const params = useDataTableParams()
  const list = useMintSwaps({ page: params.page, take: PAGE_SIZE, status: 'NEEDS_ACTION' })
  const pending = usePendingSettledManual()
  const [colVisibility, setColVisibility] = useColumnVisibility('mint-swap-issues', MINT_SWAP_ISSUE_COLUMN_CONFIG)

  const rows = list.data?.data ?? []
  const suffix = params.searchParams.toString() ? `?${params.searchParams}` : ''
  const openDetail = (id: string) => navigate(`${BASE}/${id}${suffix}`)
  const returnFocus = useReturnFocusToRow(activeId)

  return (
    <div>
      <PageHeader
        title="Swap Bermasalah"
        subtitle="Swap IDR→USD yang tidak bisa diselesaikan sistem sendiri. Mint order ini tertahan sampai swapnya beres. Yang paling lama menunggu ada di atas."
        actions={
          canResolve ? undefined : (
            <span className="rounded-sm bg-muted px-2 py-1 text-label font-medium text-muted-foreground" data-testid="mint-swap-readonly">
              Hanya bisa melihat — aksi untuk Manager dan Admin
            </span>
          )
        }
      />
      <DataTable<MintSwapListItem>
        columns={mintSwapIssueColumns(openDetail, pending.bySwap)}
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
          <TableToolbar
            columns={{ items: MINT_SWAP_ISSUE_COLUMN_CONFIG, visibility: colVisibility, onChange: setColVisibility }}
          />
        }
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={<CheckCircle2 className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Tidak ada swap bermasalah"
            description="Semua swap sedang berjalan atau sudah selesai. Swap baru muncul di sini kalau BNI menolaknya, lewat 30 menit tanpa hasil, atau swap dimatikan di server."
          />
        }
        onRowClick={(r) => openDetail(r.id)}
        rowAriaLabel={(r) =>
          `Swap bermasalah ${r.customerName ?? 'nasabah'} ${formatUsdxExact(r.amountUsdx)}: ${mintSwapIssueLabel(r.issueCode) ?? 'tanpa kode'}${pending.bySwap.has(r.id) ? ' (menunggu persetujuan)' : ''}, menunggu ${formatWaiting(r.waitingSeconds)}`
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
