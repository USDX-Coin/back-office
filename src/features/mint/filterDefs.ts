// USDX-27: filter / sort / column config for the request list (shared by both
// MintListPage and BurnListPage — they hit the same `/api/v1/requests` endpoint
// so the schema is the same). Burn imports from here on purpose.
import type {
  ColumnConfig,
  FilterDef,
  SortColumnDef,
} from '@/components/table/types'

export const REQUEST_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'PENDING_APPROVAL', label: 'Pending approval' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'EXECUTED', label: 'Executed' },
      { value: 'IDR_TRANSFERRED', label: 'IDR transferred' },
      { value: 'REJECTED', label: 'Rejected' },
    ],
  },
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
    key: 'safeType',
    label: 'Safe',
    options: [
      { value: 'STAFF', label: 'Staff Safe' },
      { value: 'MANAGER', label: 'Manager Safe' },
    ],
  },
  // USDX-98: BE GET /api/v1/requests accepts startDate/endDate (YYYY-MM-DD,
  // Asia/Jakarta). USDX-27 shipped the generic dateRange capability but never
  // wired it into the request lists — this is that wiring.
  {
    kind: 'dateRange',
    startKey: 'startDate',
    endKey: 'endDate',
    label: 'Date range',
  },
]

// Date column is the only field BE supports sorting by today (the requests
// hooks pass `sortBy` straight through but only `createdAt` is documented in
// `sot/api/requests.yaml`). Add more entries here once the contract grows.
export const REQUEST_SORT_COLUMNS: SortColumnDef[] = [
  { id: 'createdAt', label: 'Date' },
]

// Column ids must match the `accessorKey` / `id` on the TanStack ColumnDef in
// MintListPage / BurnListPage.
export const REQUEST_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'createdAt', label: 'Date', required: true },
  { key: 'user', label: 'User', required: true },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'chain', label: 'Chain' },
  { key: 'safeType', label: 'Safe' },
  { key: 'status', label: 'Status' },
  { key: 'onchainTx', label: 'On-chain tx' },
  { key: 'safeTx', label: 'Safe tx' },
]
