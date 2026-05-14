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
    label: 'Chain',
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
    label: 'Type',
    options: [
      { value: 'mint', label: 'Mint' },
      { value: 'burn', label: 'Burn' },
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
  { key: 'id', label: 'Request ID', required: true },
  { key: 'type', label: 'Type', required: true },
  { key: 'chain', label: 'Chain' },
  { key: 'user', label: 'Customer', required: true },
  { key: 'safeType', label: 'Safe' },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'safeTx', label: 'Safe tx' },
  { key: 'actions', label: 'Action', required: true },
]
