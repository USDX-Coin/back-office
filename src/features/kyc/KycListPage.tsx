import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, ShieldCheck } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import { RequestIdCell } from '@/components/RequestIdCell'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { KYC_COLUMN_CONFIG, KYC_FILTER_DEFS } from './filterDefs'
import KycDetailModal from './KycDetailModal'
import { formatShortDate } from '@/lib/format'
import { getKycStatusConfig } from '@/lib/status'
import type { EntityType, KycListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useKycList } from './hooks'

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Individual',
  LEGAL_ENTITY: 'Legal entity',
}

// sot/api/common.yaml § Limit default — also the Linear AC: 11 items → 2 pages.
const PAGE_SIZE = 10

export default function KycListPage() {
  const navigate = useNavigate()

  // Deep-link route `/kyc/:id` — same pattern as /mint/:id (USDX-78): the list
  // stays rendered behind the modal and the modal is driven by the URL, so
  // refresh / share keeps it open.
  const { id: activeId } = useParams<{ id?: string }>()

  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const status = params.searchParams.get('status') ?? ''
  const entityType = params.searchParams.get('entityType') ?? ''
  const startDate = params.searchParams.get('startDate') ?? ''
  const endDate = params.searchParams.get('endDate') ?? ''

  const list = useKycList({
    page: params.page,
    limit: PAGE_SIZE,
    status: status || undefined,
    entityType: entityType || undefined,
    search: search || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  const [colVisibility, setColVisibility] = useColumnVisibility('kyc', KYC_COLUMN_CONFIG)

  const filterValues = { status, entityType, startDate, endDate }
  const hasFilters = Boolean(search || status || entityType || startDate || endDate)

  const columns: ColumnDef<KycListItem>[] = [
    {
      id: 'id',
      header: 'ID',
      cell: ({ row }) => <RequestIdCell id={row.original.id} />,
    },
    {
      accessorKey: 'userEmail',
      header: 'User Email',
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'entityType',
      header: 'Entity Type',
      cell: ({ getValue }) => (
        <span className="text-[12px] text-muted-foreground">
          {ENTITY_LABEL[getValue() as EntityType]}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = getKycStatusConfig(getValue() as KycListItem['status'])
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
              cfg.className
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
            navigate(`/kyc/${row.original.id}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`Review KYC submission for ${row.original.userEmail}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Review
        </button>
      ),
    },
  ]

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  // Best-effort: on deep-link / refresh the active row may not be on the
  // current page — the shell modal degrades to ID-only rendering.
  const activeListItem = activeId ? (rows.find((r) => r.id === activeId) ?? null) : null

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<ShieldCheck className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="No KYC submissions yet"
      description="KYC submissions from the consumer app will appear here for review."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="KYC"
        italicAccent="Review"
        subtitle="Review consumer identity submissions — oldest first for fairness."
      />

      <DataTable<KycListItem>
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
              placeholder: 'Search user email…',
              onChange: (next) => params.updateParams({ search: next || null, page: '1' }),
            }}
            // No sort control: sot/api/kyc.yaml § list exposes no sort params —
            // the server always returns submitted_at ascending.
            filter={{
              defs: KYC_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                params.updateParams({
                  status: next.status || null,
                  entityType: next.entityType || null,
                  startDate: next.startDate || null,
                  endDate: next.endDate || null,
                  page: '1',
                }),
            }}
            columns={{
              items: KYC_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => navigate(`/kyc/${r.id}`)}
        rowAriaLabel={(r) => `Open KYC submission for ${r.userEmail}`}
      />

      <KycDetailModal
        kycId={activeId ?? null}
        listItem={activeListItem}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          // Close → back to /kyc, replacing the /kyc/:id history entry so the
          // back button doesn't immediately reopen the modal.
          if (!o) navigate('/kyc', { replace: true })
        }}
      />
    </div>
  )
}
