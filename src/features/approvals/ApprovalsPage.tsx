import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Eye, UserCheck } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import StatusPill from '@/components/StatusPill'
import { TableCellText } from '@/components/ui/table'
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
import { formatActor, useStaffDirectory } from '@/features/staff-directory/hooks'
import { useAuth } from '@/lib/auth'
import { formatWibDateTime } from '@/lib/format'
import { canDecideApproval } from './access'
import ApprovalDetailModal from './ApprovalDetailModal'
import { APPROVAL_COLUMN_CONFIG, APPROVAL_FILTER_DEFS } from './filterDefs'
import { useApprovals } from './hooks'
import {
  actionTypeLabel,
  amountLabel,
  formatExpiry,
  isApprovedButNotExecuted,
  isExpirySoon,
  statusPill,
} from './labels'
import type { ApprovalActionType, ApprovalRequest, ApprovalStatus } from './types'

const PAGE_SIZE = 20

const STATUSES: ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']
const ACTION_TYPES: ApprovalActionType[] = [
  'PAYOUT_CONTROLS_RELEASE',
  'HELD_CREDIT_RESOLVE',
  'PAYOUT_CONTROLS_LIMITS',
]

function asStatus(value: string): ApprovalStatus | undefined {
  return (STATUSES as string[]).includes(value) ? (value as ApprovalStatus) : undefined
}

function asActionType(value: string): ApprovalActionType | undefined {
  return (ACTION_TYPES as string[]).includes(value) ? (value as ApprovalActionType) : undefined
}

/**
 * Persetujuan Orang Kedua — antrean maker-checker (`/api/v1/approvals`,
 * USDX-486).
 *
 * POJK 4/2021 Penjelasan Pasal 5 mewajibkan pihak yang meng-input data berbeda
 * dari pihak yang memvalidasinya. Backend sudah menegakkannya sejak USDX-486 —
 * dan sampai layar ini ada, kontrol itu tidak pernah bisa dipakai: setiap aksi
 * back office di atas Rp 10 juta melahirkan usulan yang tak punya pintu, lalu
 * kedaluwarsa dalam diam.
 *
 * TANPA RoleGuard di rutenya, dan itu disengaja (pola /kyc, /screening,
 * /payout-failures): kontraknya membuka list + detail untuk keempat peran, dan
 * PENGUSUL harus bisa melihat nasib usulannya sendiri. Yang digerbangi adalah
 * MEMUTUSKAN — MANAGER/ADMIN — dan gerbang itu hidup di dalam layar, dengan
 * alasannya ditulis, bukan sebagai tombol mati tanpa keterangan.
 */
export default function ApprovalsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: activeId } = useParams<{ id?: string }>()
  const params = useDataTableParams()
  const { directory } = useStaffDirectory()

  const status = asStatus(params.searchParams.get('status') ?? '')
  const actionType = asActionType(params.searchParams.get('actionType') ?? '')
  const filters = { page: params.page, take: PAGE_SIZE, status, actionType }
  const list = useApprovals(filters)

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'approvals',
    APPROVAL_COLUMN_CONFIG
  )

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  const query = params.searchParams.toString()
  const suffix = query ? `?${query}` : ''
  const openDetail = (id: string) => navigate(`/persetujuan/${id}${suffix}`)

  // Usulan yang DISETUJUI tapi aksinya tidak berjalan. Schema backend menyebut
  // keadaan ini "WAJIB terlihat ops" dan tidak ada yang pernah menayangkannya —
  // ia diangkat ke atas tabel, bukan disembunyikan di dalam satu baris.
  const stalled = rows.filter(isApprovedButNotExecuted)

  const columns: ColumnDef<ApprovalRequest>[] = [
    {
      id: 'proposedAt',
      header: 'Diusulkan',
      // `YYYY-MM-DD HH:MM:SS WIB` utuh butuh 192px — angka yang sama dipakai
      // Jejak Audit dan Mint Bermasalah untuk format ini. 168px memotong
      // detiknya, bagian yang justru dipakai mengurutkan dua usulan berdekatan.
      size: 192,
      cell: ({ row }) => (
        <TableCellText
          value={formatWibDateTime(row.original.proposedAt)}
          className="font-mono text-2xs tabular-nums text-muted-foreground"
        />
      ),
    },
    {
      id: 'actionType',
      header: 'Usulan',
      size: 208,
      cell: ({ row }) => (
        <span className="truncate text-xs" title={row.original.actionType}>
          {actionTypeLabel(row.original.actionType)}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Nominal',
      // Nominal rupiah yang akan dilepas kalau usulan ini disetujui.
      size: 184,
      cell: ({ row }) =>
        row.original.amountIdr === null ? (
          <span className="text-2xs text-muted-foreground">Tanpa nominal</span>
        ) : (
          <TableCellText
            value={amountLabel(row.original.amountIdr)}
            className="font-mono text-sm font-semibold tabular-nums"
          />
        ),
    },
    {
      id: 'status',
      header: 'Keadaan',
      size: 176,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <StatusPill cfg={statusPill(row.original.status)} className="w-fit" />
          {isApprovedButNotExecuted(row.original) && (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Belum berjalan
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'proposer',
      header: 'Pengusul',
      size: 140,
      cell: ({ row }) => (
        <span className="truncate text-xs" title={row.original.proposerStaffId}>
          {formatActor(directory, row.original.proposerStaffId)}
        </span>
      ),
    },
    {
      id: 'deadline',
      header: 'Batas waktu',
      size: 128,
      cell: ({ row }) => {
        if (row.original.status !== 'PENDING') {
          return <span className="text-2xs text-muted-foreground">—</span>
        }
        const soon = isExpirySoon(row.original.expiresAt)
        return (
          <span
            className={
              soon
                ? 'font-mono text-xs font-medium tabular-nums text-warning'
                : 'font-mono text-xs tabular-nums'
            }
            title={formatWibDateTime(row.original.expiresAt)}
          >
            {formatExpiry(row.original.expiresAt)}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      size: 88,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openDetail(row.original.id)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-2xs font-medium text-primary transition-colors hover:bg-muted"
          aria-label={`Buka usulan ${actionTypeLabel(row.original.actionType)}`}
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
          title="Persetujuan Orang Kedua"
          subtitle="Aksi back office yang menggerakkan rupiah di atas Rp 10 juta tidak berjalan sendiri — ia menjadi usulan yang harus dibuka staf lain. Pengusul tidak boleh menjadi penyetujunya."
          actions={
            canDecideApproval(user) ? undefined : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="rounded-sm bg-muted px-2 py-1 text-2xs font-medium text-muted-foreground"
                  >
                    Hanya bisa melihat
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Menyetujui atau menolak usulan hanya untuk Manager dan Admin — server
                  menolak peran lain dengan 403
                </TooltipContent>
              </Tooltip>
            )
          }
        />

        {stalled.length > 0 && (
          <div
            data-testid="usulan-macet"
            className="mb-5 flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 px-3.5 py-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 text-xs leading-relaxed">
              <p className="font-medium text-destructive">
                {stalled.length} usulan sudah disetujui tapi aksinya belum berjalan.
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Persetujuan sudah diberikan, uangnya belum bergerak. Buka detailnya —
                pesan kegagalan eksekusinya ada di sana. Usulan seperti ini sengaja TIDAK
                dikembalikan ke menunggu: mengulanginya otomatis berisiko menjalankan aksi
                yang mungkin sudah separuh berjalan.
              </p>
            </div>
          </div>
        )}

        <DataTable<ApprovalRequest>
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
              filter={{
                defs: APPROVAL_FILTER_DEFS,
                values: { status: status ?? '', actionType: actionType ?? '' },
                onChange: (next) =>
                  params.updateParams({
                    status: next.status || null,
                    actionType: next.actionType || null,
                    page: '1',
                  }),
              }}
              columns={{
                items: APPROVAL_COLUMN_CONFIG,
                visibility: colVisibility,
                onChange: setColVisibility,
              }}
            />
          }
          hasFilters={Boolean(status || actionType)}
          emptyState={
            <TableEmptyState
              mode="no-data"
              icon={<UserCheck className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
              title="Tidak ada usulan"
              description="Belum ada aksi bernominal besar yang menunggu orang kedua. Usulan muncul sendiri di sini begitu ada yang menyelesaikan mint bermasalah di atas Rp 10 juta, melepas rem pencairan, atau mengubah plafonnya."
            />
          }
          onRowClick={(row) => openDetail(row.id)}
          rowAriaLabel={(row) =>
            `Usulan ${actionTypeLabel(row.actionType)} ${amountLabel(row.amountIdr)}`
          }
        />

        <ApprovalDetailModal
          approvalId={activeId ?? null}
          open={Boolean(activeId)}
          onOpenChange={(open) => {
            if (!open) navigate(`/persetujuan${suffix}`, { replace: true })
          }}
        />
      </div>
    </TooltipProvider>
  )
}
