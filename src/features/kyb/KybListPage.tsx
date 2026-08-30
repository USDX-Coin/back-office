import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Building2, Eye, Plus } from 'lucide-react'
import DataTable from '@/components/DataTable'
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
      header: 'Entity',
      cell: ({ getValue }) => {
        const name = getValue() as string | null
        return name ? (
          <span className="font-medium">{name}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: 'userEmail',
      header: 'Account email',
      cell: ({ getValue }) => (
        <span className="break-all text-[12.5px] text-muted-foreground">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'entityForm',
      header: 'Legal form',
      cell: ({ getValue }) => (
        <span className="text-[12.5px] text-muted-foreground">
          {labelFor(getValue() as KybEntityForm, KYB_ENTITY_FORM_LABELS) ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = getKycStatusConfig(getValue() as KybListItem['status'])
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
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
      header: 'Submitted At',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return (
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {v ? formatShortDate(v) : '—'}
          </span>
        )
      },
    },
    {
      accessorKey: 'submissionCount',
      header: 'Submissions',
      cell: ({ getValue }) => (
        <span className="font-mono text-[12px] tabular-nums">
          {getValue() as number}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/kyb/${row.original.id}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`Review KYB record for ${rowLabel(row.original)}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Review
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
      title="No KYB records yet"
      description="Business-entity due diligence is entered here by an operator — there is no self-service KYB submission."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="KYB"
        italicAccent="Review"
        subtitle="Business-entity due diligence — entered manually by an operator, then approved or rejected."
        actions={
          canCreate ? (
            <Button
              onClick={() => navigate('/kyb/new')}
              size="sm"
              className="h-7 text-[12px]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add KYB record
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
              placeholder: 'Search account name or email…',
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
        rowAriaLabel={(r) => `Open KYB record for ${rowLabel(r)}`}
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
