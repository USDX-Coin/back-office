// USDX-87: filter / sort / column schema for the Manual Sync list. Consumed
// by ManualSyncPage via the generic TableToolbar (USDX-27 primitive). Mirrors
// the pattern in features/mint/filterDefs.ts.
//
// SoT: sot/api/manual-sync.yaml GET /api/v1/manual-sync supports `?chain` and
// `?type` query params only — keep the FE filter set aligned, no `status`
// filter because the endpoint already scopes to PENDING_APPROVAL / APPROVED.
import type {
  ColumnConfig,
  FilterDef,
  SortColumnDef,
} from '@/components/table/types'

export const MANUAL_SYNC_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'chain',
    label: 'Jaringan',
    options: [
      { value: 'ethereum', label: 'Ethereum' },
      { value: 'polygon', label: 'Polygon' },
      { value: 'arbitrum', label: 'Arbitrum' },
      { value: 'base', label: 'Base' },
    ],
  },
  {
    kind: 'select',
    key: 'type',
    label: 'Jenis',
    options: [
      { value: 'mint', label: 'Mint OTC' },
      { value: 'burn', label: 'Burn OTC' },
      // USDX-208: consumer mint_orders extended into Manual Sync (Phase 2 W2).
      // "Mint nasabah" = order mint dari aplikasi nasabah, bukan mint OTC yang
      // diajukan operator — dua populasi yang tidak boleh terbaca sama.
      { value: 'mint_order', label: 'Mint nasabah' },
    ],
  },
]

// sot/api/manual-sync.yaml § list: BE returns the array sorted by `createdAt`
// asc. There's no `?sortBy=` param documented — surfacing a Sort popover would
// be misleading until BE exposes it. Keep this empty until BE catches up.
export const MANUAL_SYNC_SORT_COLUMNS: SortColumnDef[] = []

// Column ids must match the `accessorKey` / `id` on the TanStack ColumnDef
// in ManualSyncPage.
export const MANUAL_SYNC_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'id', label: 'ID request', required: true },
  { key: 'type', label: 'Jenis', required: true },
  { key: 'chain', label: 'Jaringan' },
  { key: 'user', label: 'Nasabah', required: true },
  { key: 'safeType', label: 'Dompet' },
  { key: 'amount', label: 'Nominal', required: true },
  { key: 'safeTx', label: 'Antrean tanda tangan' },
  { key: 'actions', label: 'Aksi', required: true },
]
