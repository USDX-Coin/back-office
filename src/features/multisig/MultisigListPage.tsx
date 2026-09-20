import { useEffect, useState } from 'react'
import { useMatch, useNavigate } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, KeyRound, AlertTriangle, Plus } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatShortDate, truncateMiddle } from '@/lib/format'
import { type StatusConfig } from '@/lib/status'
import { useAuth, canProposeGovernance } from '@/lib/auth'
import {
  getActivityLabel,
  getSafeTxStatusConfig,
  isUnknownActivity,
} from '@/lib/multisig/status'
import type { SafeTxListItem, SafeTxStatus, SafeType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useMultisigList } from './hooks'
import SignatureProgressBar from './SignatureProgressBar'
import MultisigTabs from './MultisigTabs'
import MultisigDetailSheet from './MultisigDetailSheet'
import ProposeModal from './ProposeModal'
import WalletConnectButton from './WalletConnectButton'

const PAGE_SIZE = 20

function StatusBadge({ cfg }: { cfg: StatusConfig }) {
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
}

export default function MultisigListPage() {
  const navigate = useNavigate()
  // Route is a /multisig/* splat (App.tsx) so the wallet provider doesn't
  // remount when the drawer opens; useMatch still resolves the :id from the URL
  // — present when the detail drawer is open, undefined on the bare list.
  const activeId = useMatch('/multisig/:id')?.params.id
  const { user } = useAuth()

  // USDX-280 — propose governance op. Admin-only (BE gates propose at admin).
  const [proposeOpen, setProposeOpen] = useState(false)
  const canPropose = canProposeGovernance(user)

  const params = useDataTableParams()
  const status = (params.searchParams.get('status') ?? '') as SafeTxStatus | ''
  const safeType = (params.searchParams.get('safeType') ?? '') as SafeType | ''
  const search = params.searchParams.get('search') ?? ''

  // Local, debounced search box → URL `search` (keeps the list query stable
  // while typing).
  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => setSearchInput(search), [search])
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) {
        params.updateParams({ search: searchInput || null, page: '1' })
      }
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const list = useMultisigList({
    page: params.page,
    limit: PAGE_SIZE,
    status: status || undefined,
    safeType: safeType || undefined,
    search: search || undefined,
  })

  const columns: ColumnDef<SafeTxListItem>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatShortDate(getValue() as string)}
        </span>
      ),
    },
    {
      id: 'activity',
      header: 'Aktivitas',
      cell: ({ row }) => {
        const { activity, activityLabel } = row.original
        const unknown = isUnknownActivity(activity)
        return (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              {unknown && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
              {activityLabel || getActivityLabel(activity)}
            </span>
            <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
              {activity}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'safeType',
      header: 'Safe',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs uppercase tracking-[0.04em]">
            {row.original.safeType}
          </span>
        </span>
      ),
    },
    {
      id: 'signatureProgress',
      header: 'Tanda tangan',
      cell: ({ row }) => <SignatureProgressBar progress={row.original.signatureProgress} />,
    },
    {
      accessorKey: 'proposerAddress',
      header: 'Pengaju',
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs tabular-nums">
            {truncateMiddle(row.original.proposerAddress, 6, 4)}
          </span>
          <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {row.original.proposerType === 'BACKEND' ? 'backend' : 'petugas'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge cfg={getSafeTxStatusConfig(getValue() as SafeTxStatus)} />
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
            navigate(`/multisig/${row.original.id}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-2xs font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`Lihat transaksi Safe ${row.original.activityLabel}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Lihat
        </button>
      ),
    },
  ]

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  const activeListItem = activeId ? rows.find((r) => r.id === activeId) ?? null : null
  const hasFilters = Boolean(status || safeType || search)

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<KeyRound className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="Belum ada transaksi Safe"
      description="Transaksi Safe untuk mint, burn, dan tata kelola yang menunggu tanda tangan akan muncul di sini."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Keuangan"
        title="Antrean Tanda Tangan"
        italicAccent="wallet Safe"
        subtitle="Transaksi wallet Safe yang menunggu ditandatangani lalu dieksekusi — mint, burn, dan operasi tata kelola."
        actions={
          <div className="flex items-center gap-2">
            {canPropose && (
              <Button size="sm" onClick={() => setProposeOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Ajukan
              </Button>
            )}
            <WalletConnectButton />
          </div>
        }
      />

      <MultisigTabs
        active={status}
        onChange={(next) =>
          params.updateParams({ status: next || null, page: '1' })
        }
      />

      <DataTable<SafeTxListItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        filterToolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari aktivitas, pengaju, atau safeTxHash…"
              className="h-9 w-full max-w-xs text-sm"
              aria-label="Cari transaksi Safe"
            />
            <Select
              value={safeType || 'ALL'}
              onValueChange={(v) =>
                params.updateParams({ safeType: v === 'ALL' ? null : v, page: '1' })
              }
            >
              <SelectTrigger className="h-9 w-[150px] text-sm" aria-label="Saring per Safe">
                <SelectValue placeholder="Semua Safe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Safe</SelectItem>
                <SelectItem value="STAFF">Safe Staff</SelectItem>
                <SelectItem value="MANAGER">Safe Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => navigate(`/multisig/${r.id}`)}
        rowAriaLabel={(r) => `Buka transaksi Safe ${r.activityLabel}`}
      />

      <MultisigDetailSheet
        txId={activeId ?? null}
        listItem={activeListItem}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) navigate('/multisig', { replace: true })
        }}
      />

      {canPropose && <ProposeModal open={proposeOpen} onOpenChange={setProposeOpen} />}
    </div>
  )
}
