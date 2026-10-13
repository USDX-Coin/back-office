import { useEffect, useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router'
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
import { formatDateTime } from '@/lib/format'
import { type StatusConfig } from '@/lib/status'
import { useAuth, canProposeGovernance } from '@/lib/auth'
import { getSafeTxStatusConfig, isUnknownActivity } from '@/lib/multisig/status'
import { proposerLabel, safeTxHeadline, safeTypeLabel } from '@/lib/multisig/present'
import type { SafeTxListItem, SafeTxStatus, SafeType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useMultisigList } from './hooks'
import SignatureProgressBar from './SignatureProgressBar'
import MultisigTabs from './MultisigTabs'
import MultisigDetailModal from './MultisigDetailModal'
import ProposeModal from './ProposeModal'
import WalletConnectButton from './WalletConnectButton'
import { STATUS_CHIP_BASE } from '@/lib/statusChip'

const PAGE_SIZE = 20

function StatusBadge({ cfg }: { cfg: StatusConfig }) {
  return (
    <span
      className={cn(
        STATUS_CHIP_BASE,
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  )
}

export default function MultisigListPage() {
  const navigate = useNavigate()
  const location = useLocation()
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
      size: 168,
      header: 'Diajukan (WIB)',
      cell: ({ getValue }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDateTime(getValue() as string)}
        </span>
      ),
    },
    {
      id: 'activity',
      header: 'Aktivitas',
      size: 208,
      cell: ({ row }) => {
        // Ops-fokus (PM Okt 2026): aktivitas dalam kata saja — tanpa enum
        // mentah (`MINT`/`BURN`) di baris kedua dan tanpa alamat di label.
        const { activity, activityLabel } = row.original
        const unknown = isUnknownActivity(activity)
        const headline = safeTxHeadline(activityLabel, activity)
        return (
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium" title={headline}>
            {unknown && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Isi tidak terbaca" />}
            <span className="truncate">{headline}</span>
          </span>
        )
      },
    },
    {
      accessorKey: 'safeType',
      size: 104,
      header: 'Safe',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{safeTypeLabel(row.original.safeType)}</span>,
    },
    {
      id: 'signatureProgress',
      size: 144,
      header: 'Tanda tangan',
      cell: ({ row }) => <SignatureProgressBar progress={row.original.signatureProgress} />,
    },
    {
      accessorKey: 'proposerAddress',
      header: 'Pengaju',
      size: 152,
      // Pengaju sebagai kata; alamat lengkapnya ada di Detail teknis modal.
      cell: ({ row }) => <span className="text-sm">{proposerLabel(row.original)}</span>,
    },
    {
      accessorKey: 'status',
      size: 176,
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge cfg={getSafeTxStatusConfig(getValue() as SafeTxStatus)} />
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
            navigate(`/multisig/${row.original.id}${location.search}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label font-medium text-primary transition-colors hover:bg-muted"
          aria-label={`Lihat transaksi ${safeTxHeadline(row.original.activityLabel, row.original.activity)}`}
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

  // ↑/↓ antar baris yang sedang tampil (pola Transaksi/OTC) tanpa menutup modal.
  const activeIndex = activeId ? rows.findIndex((r) => r.id === activeId) : -1
  const goTo = (i: number) => navigate(`/multisig/${rows[i]!.id}${location.search}`, { replace: true })
  const modalNav = {
    index: activeIndex >= 0 ? activeIndex : null,
    total: rows.length,
    onPrev: activeIndex > 0 ? () => goTo(activeIndex - 1) : undefined,
    onNext: activeIndex >= 0 && activeIndex < rows.length - 1 ? () => goTo(activeIndex + 1) : undefined,
  }

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
        title="Antrean Tanda Tangan"
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
              placeholder="Cari aktivitas atau pengaju…"
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
                <SelectItem value="STAFF">Safe Staf</SelectItem>
                <SelectItem value="MANAGER">Safe Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => navigate(`/multisig/${r.id}${location.search}`)}
        rowAriaLabel={(r) => `Buka transaksi ${safeTxHeadline(r.activityLabel, r.activity)}`}
      />

      {activeId && (
        <MultisigDetailModal
          key={activeId}
          txId={activeId}
          listItem={activeListItem}
          onClose={() => navigate(`/multisig${location.search}`, { replace: true })}
          nav={modalNav}
        />
      )}

      {canPropose && <ProposeModal open={proposeOpen} onOpenChange={setProposeOpen} />}
    </div>
  )
}
