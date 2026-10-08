import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Copy, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import TableToolbar from '@/components/table/TableToolbar'
import TruncatedHash from '@/components/TruncatedHash'
import { TxHashLink } from '@/components/OnChainLinks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useChainConfig } from '@/features/chains/hooks'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { findChainConfig } from '@/lib/chainLinks'
import { safeTxUrl } from '@/lib/safeUrl'
import { formatUsdxListAmount, shortRequestId } from '@/lib/format'
import type { ManualSyncItem, ManualSyncType, RequestChain, SafeType } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  MANUAL_SYNC_COLUMN_CONFIG,
  MANUAL_SYNC_FILTER_DEFS,
} from './filterDefs'
import { useManualSyncList } from './hooks'
import UpdateTxHashModal from './UpdateTxHashModal'

const CHAIN_LABEL: Record<RequestChain, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  base: 'Base',
}

const CHAIN_DOT: Record<RequestChain, string> = {
  ethereum: 'bg-[#627EEA]',
  polygon: 'bg-[#8247E5]',
  arbitrum: 'bg-[#28A0F0]',
  base: 'bg-[#0052FF]',
}

const SAFE_LABEL: Record<SafeType, string> = {
  STAFF: 'Staf',
  MANAGER: 'Manager',
}

// USDX-208: Manual Sync now carries consumer `mint_order` rows alongside OTC
// mint/burn. mint & mint_order share the primary (maroon) family (both mint USDX) —
// OTC mint is filled, the consumer mint_order is outlined so they're
// distinguishable at a glance; burn stays amber.
// "Mint nasabah" = order mint dari aplikasi nasabah; "Mint OTC"/"Burn OTC" =
// request yang diajukan operator. Tiga populasi berbeda di satu tabel, jadi
// labelnya harus memisahkan ketiganya tanpa perlu ditebak.
const TYPE_LABEL: Record<ManualSyncType, string> = {
  mint: 'Mint OTC',
  burn: 'Burn OTC',
  mint_order: 'Mint nasabah',
}

const TYPE_BADGE_CLASS: Record<ManualSyncType, string> = {
  mint: 'bg-primary/10 text-primary',
  burn: 'bg-warning/10 text-warning',
  mint_order: 'border border-primary/40 bg-transparent text-primary',
}

// USDX-87 — visual highlight for `?highlight=<id>` deep-links from the
// SAFE_QUEUE_OCCUPIED banner (USDX-84). Animated 3s fade so it doesn't
// distract longer than necessary once the operator's eyes land on the row.
const HIGHLIGHT_DURATION_MS = 3000

async function copyId(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('ID request disalin')
  } catch {
    toast.error('Gagal menyalin')
  }
}

export default function ManualSyncPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const chain = searchParams.get('chain') ?? ''
  const type = (searchParams.get('type') ?? '') as ManualSyncType | ''
  // Manual Sync is endpoint-scoped to PENDING_APPROVAL / APPROVED and is not
  // paginated (sot/api/manual-sync.yaml — no `?page=` param); the search
  // input is purely client-side substring filter over id / userName /
  // userAddress so operators can scope a long list quickly.
  const search = searchParams.get('search') ?? ''

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    })
    setSearchParams(next, { replace: true })
  }

  const list = useManualSyncList({ chain: chain || undefined, type: type || undefined })
  const { data: chains } = useChainConfig()

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'manual-sync',
    MANUAL_SYNC_COLUMN_CONFIG
  )

  const [activeItem, setActiveItem] = useState<ManualSyncItem | null>(null)

  // USDX-87 deep-link highlight, hardened in USDX-101. The fade countdown
  // must not start until the list query has actually settled: with a slow
  // real-BE fetch (>3s) the old mount-time timer expired before rows
  // rendered, so the `?highlight=<id>` row never got tinted.
  const highlightId = searchParams.get('highlight') ?? ''
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listFetched = list.isFetched

  // Reset the fade when the deep-link target changes — render-time reset
  // (React-sanctioned) instead of a sync setState effect. Covers re-trigger
  // of the same id too, since the fade strips `?highlight=` so the id always
  // transitions through '' before reappearing.
  const [prevHighlightId, setPrevHighlightId] = useState(highlightId)
  const [faded, setFaded] = useState(false)
  if (highlightId !== prevHighlightId) {
    setPrevHighlightId(highlightId)
    setFaded(false)
  }
  const activeHighlight = highlightId && !faded ? highlightId : ''

  // Arm the 3s fade only once the list has settled. `isFetched` is true for
  // success AND error (so a failed fetch still clears the URL) and stays
  // true across background refetches (so a refetch can't reset/extend the
  // fade). Re-runs — and re-arms — only when the deep-link target changes.
  useEffect(() => {
    if (!highlightId || !listFetched) return
    highlightTimerRef.current = setTimeout(() => {
      setFaded(true)
      // Functional updater: drop only `highlight`, never clobber filter
      // params the operator may have changed during the fade window.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('highlight')
          return next
        },
        { replace: true }
      )
    }, HIGHLIGHT_DURATION_MS)
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [highlightId, listFetched, setSearchParams])

  // Scroll the highlighted row into view once rows are rendered. The anchor
  // is rendered inside the first cell of the matching row (see id column).
  useEffect(() => {
    if (!activeHighlight) return
    const anchor = document.querySelector<HTMLElement>(
      '[data-highlight-anchor="true"]'
    )
    if (anchor) anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeHighlight, list.data])

  const rows = useMemo(() => {
    const all = list.data ?? []
    if (!search) return all
    const needle = search.trim().toLowerCase()
    return all.filter(
      (r) =>
        r.id.toLowerCase().includes(needle) ||
        r.userName.toLowerCase().includes(needle) ||
        r.userAddress.toLowerCase().includes(needle)
    )
  }, [list.data, search])

  const filterValues = { chain, type }
  const hasFilters = Boolean(search || chain || type)

  const columns: ColumnDef<ManualSyncItem>[] = [
    {
      id: 'id',
      size: 152,
      header: 'ID request',
      cell: ({ row }) => {
        const isHighlight = activeHighlight === row.original.id
        return (
          <span
            className="inline-flex items-center gap-1.5 font-mono text-2xs"
            data-highlight-anchor={isHighlight ? 'true' : undefined}
          >
            <span className="text-foreground" title={row.original.id}>
              {shortRequestId(row.original.id)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void copyId(row.original.id)
              }}
              className="text-muted-foreground hover:text-primary"
              aria-label="Salin ID request"
              title="Salin ID request lengkap"
            >
              <Copy className="h-3 w-3" />
            </button>
          </span>
        )
      },
    },
    {
      accessorKey: 'type',
      size: 104,
      header: 'Jenis',
      cell: ({ getValue }) => {
        const t = getValue() as ManualSyncItem['type']
        return (
          <Badge
            variant="secondary"
            className={cn(
              'rounded-sm text-2xs font-medium uppercase tracking-[0.04em]',
              TYPE_BADGE_CLASS[t]
            )}
          >
            {TYPE_LABEL[t] ?? t}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'chain',
      size: 120,
      header: 'Jaringan',
      cell: ({ getValue }) => {
        const c = getValue() as RequestChain
        return (
          <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', CHAIN_DOT[c])} />
            {CHAIN_LABEL[c] ?? c}
          </span>
        )
      },
    },
    {
      id: 'user',
      header: 'Nasabah',
      size: 200,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium" title={row.original.userName}>
            {row.original.userName}
          </span>
          <span className="font-mono text-2xs text-muted-foreground">
            <TruncatedHash value={row.original.userAddress} />
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'safeType',
      size: 96,
      header: 'Dompet',
      cell: ({ getValue }) => (
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {SAFE_LABEL[getValue() as SafeType]}
        </span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Nominal',
      // Nominal request yang nyangkut. Tanpa `size` kolomnya 120px, dan
      // pembungkusnya `flex` (kotak blok) jadi kelebihannya dipotong tanpa
      // elipsis. Nilai utuh ikut di `title`.
      size: 176,
      cell: ({ row }) => {
        const teks = `${formatUsdxListAmount(row.original.amount)} USDX`
        return (
          <span
            className="block truncate font-mono font-medium tabular-nums"
            title={teks}
          >
            {teks.replace(/ USDX$/, '')}{' '}
            <span className="text-2xs text-muted-foreground">USDX</span>
          </span>
        )
      },
    },
    {
      id: 'safeTx',
      size: 176,
      header: 'Antrean tanda tangan',
      cell: ({ row }) => {
        const cfg = findChainConfig(chains, row.original.chain)
        const href = safeTxUrl({
          chain: cfg,
          safeType: row.original.safeType,
          safeTxHash: row.original.safeTxHash,
        })
        return (
          <TxHashLink
            hash={row.original.safeTxHash}
            href={href}
            label="Lihat transaksi di Safe"
          />
        )
      },
    },
    {
      id: 'actions',
      size: 104,
      header: 'Aksi',
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-2xs"
          onClick={(e) => {
            e.stopPropagation()
            setActiveItem(row.original)
          }}
        >
          Perbaiki
        </Button>
      ),
    },
  ]

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<Wrench className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="Tidak ada status yang nyangkut"
      description="Semua mint OTC, burn OTC, dan mint nasabah sudah dieksekusi atau ditolak."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Pekerjaan Hari Ini"
        title="Perbaiki Status Nyangkut"
        italicAccent="request tertahan"
        subtitle="Untuk request yang sudah jalan di blockchain tapi statusnya di sistem belum ikut berubah. Tempelkan bukti transaksinya, sistem memeriksa kecocokannya, lalu statusnya diperbaiki."
      />

      <DataTable<ManualSyncItem>
        columns={columns}
        data={rows}
        rowCount={rows.length}
        pageSize={50}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        filterToolbar={
          <TableToolbar
            search={{
              value: search,
              placeholder: 'Cari ID request, nasabah, alamat wallet…',
              onChange: (next) => updateParams({ search: next || null }),
            }}
            filter={{
              defs: MANUAL_SYNC_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                updateParams({
                  chain: next.chain || null,
                  type: next.type || null,
                }),
            }}
            columns={{
              items: MANUAL_SYNC_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        rowClassName={(row) =>
          activeHighlight === row.id
            ? 'bg-warning/10 transition-colors duration-700'
            : 'transition-colors duration-700'
        }
      />

      <UpdateTxHashModal
        item={activeItem}
        open={Boolean(activeItem)}
        onOpenChange={(o) => {
          if (!o) setActiveItem(null)
        }}
      />
    </div>
  )
}
