import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Building2, Eye, Plus } from 'lucide-react'
import DataTable from '@/components/DataTable'
import { TableCellText } from '@/components/ui/table'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import { RequestIdCell } from '@/components/RequestIdCell'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { Button } from '@/components/ui/button'
import { KYB_COLUMN_CONFIG, KYB_FILTER_DEFS } from './filterDefs'
import KybDetailModal from './KybDetailModal'
import { canReviewKyc, useAuth } from '@/lib/auth'
import { KYB_ENTITY_FORM_LABELS, labelFor } from '@/lib/cdd'
import { formatShortDate } from '@/lib/format'
import { getKycStatusConfig } from '@/lib/status'
import type { KybEntityForm, KybListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useKybList } from './hooks'

// Same page size as the KYC queue.
const PAGE_SIZE = 10

/**
 * How a row names itself to a screen reader. `userName` may be null, and the
 * account email is then the only identifier the response carries — the entity's
 * registered name is not in the list payload at all (encrypted column).
 */
function rowLabel(row: KybListItem): string {
  return row.userName ?? row.userEmail
}

/**
 * USDX-546 — KYB review queue.
 *
 * Unlike the KYC list, this page has an "Add KYB record" action: KYB is a MANUAL
 * flow (decision Mas Yan — KYB partner manual, bukan API), so nothing submits
 * these records except a USDX operator. A LEGAL_ENTITY *account* can already be
 * created today through `POST /api/v1/users`; what was missing is somewhere to
 * keep the entity's due-diligence data, which is what this page fills.
 */
export default function KybListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Entering / reviewing KYB follows the KYC review entitlement: every role can
  // read the queue, DEVELOPER cannot act on it (backend enforces 403 regardless).
  const canCreate = canReviewKyc(user)

  const { id: activeId } = useParams<{ id?: string }>()

  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const status = params.searchParams.get('status') ?? ''

  const list = useKybList({
    page: params.page,
    limit: PAGE_SIZE,
    status: status || undefined,
    search: search || undefined,
  })

  const [colVisibility, setColVisibility] = useColumnVisibility('kyb', KYB_COLUMN_CONFIG)

  const filterValues = { status }
  const hasFilters = Boolean(search || status)

  const columns: ColumnDef<KybListItem>[] = [
    {
      id: 'id',
      size: 152,
      header: 'ID',
      cell: ({ row }) => <RequestIdCell id={row.original.id} />,
    },
    {
      // `users.name`, NOT `kyb.entity_name`. The registered name is encrypted
      // with a random IV, so the list query can neither select nor search it —
      // `GET /api/v1/kyb` carries no ciphertext column at all, by design
      // (`kyb.types.ts`). This is the name the backend puts in the queue for
      // exactly that reason, and the NIB column that used to sit beside it was
      // reading a field the response has never contained.
      accessorKey: 'userName',
      size: 200,
      header: 'Badan usaha',
      cell: ({ getValue }) => {
        const name = getValue() as string | null
        return name ? (
          <TableCellText value={name} className="font-medium" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: 'userEmail',
      size: 232,
      header: 'Email akun',
      cell: ({ getValue }) => (
        <TableCellText
          value={getValue() as string}
          className="text-xs text-muted-foreground"
        />
      ),
    },
    {
      accessorKey: 'entityForm',
      size: 152,
      header: 'Bentuk badan',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">
          {labelFor(getValue() as KybEntityForm, KYB_ENTITY_FORM_LABELS) ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      size: 144,
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = getKycStatusConfig(getValue() as KybListItem['status'])
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-2xs font-medium',
              cfg.className,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
            {cfg.label}
          </span>
        )
      },
    },
    {
      accessorKey: 'submittedAt',
      size: 128,
      header: 'Diajukan',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {v ? formatShortDate(v) : '—'}
          </span>
        )
      },
    },
    {
      accessorKey: 'submissionCount',
      size: 104,
      header: 'Pengajuan',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs tabular-nums">
          {getValue() as number}
        </span>
      ),
    },
    {
      id: 'actions',
      size: 104,
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/kyb/${row.original.id}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-2xs font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`Periksa berkas KYB ${rowLabel(row.original)}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Periksa
        </button>
      ),
    },
  ]

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  const activeListItem = activeId ? (rows.find((r) => r.id === activeId) ?? null) : null

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<Building2 className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="Belum ada berkas KYB"
      description="Penelaahan badan usaha diketik operator di sini — tidak ada pengajuan KYB mandiri dari nasabah."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Nasabah"
        title="Verifikasi Badan Usaha"
        italicAccent="KYB"
        subtitle="Penelaahan badan usaha — datanya diketik operator dari dokumen, lalu disetujui atau ditolak."
        actions={
          canCreate ? (
            <Button
              onClick={() => navigate('/kyb/new')}
              size="sm"
              className="h-7 text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tambah berkas KYB
            </Button>
          ) : undefined
        }
      />

      <DataTable<KybListItem>
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
            search={{
              value: search,
              // Deliberately not "search entity name": the server matches
              // `users.name` and `users.email` only. `kyb.entity_name` is
              // ciphertext, so promising to search it would promise nothing.
              placeholder: 'Cari nama atau email akun…',
              onChange: (next) => params.updateParams({ search: next || null, page: '1' }),
            }}
            filter={{
              defs: KYB_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                params.updateParams({ status: next.status || null, page: '1' }),
            }}
            columns={{
              items: KYB_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => navigate(`/kyb/${r.id}`)}
        rowAriaLabel={(r) => `Buka berkas KYB ${rowLabel(r)}`}
      />

      <KybDetailModal
        kybId={activeId ?? null}
        listItem={activeListItem}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) navigate('/kyb', { replace: true })
        }}
      />
    </div>
  )
}
