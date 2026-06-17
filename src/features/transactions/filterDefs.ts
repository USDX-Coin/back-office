// USDX-206 — filter + column config for the User Transaction list.
// sot/api/orders.yaml § list params: type / status / paymentStatus / safeStatus
// / userId. No `search` or sort params in the contract, so the toolbar renders
// only the Filter + Columns popovers. `userId` is a programmatic (deep-link)
// filter — not surfaced as a visible control.
import type { ColumnConfig, FilterDef } from '@/components/table/types'

export const ORDER_FILTER_DEFS: FilterDef[] = [
  {
    kind: 'select',
    key: 'type',
    label: 'Type',
    options: [
      { value: 'MINT', label: 'Mint' },
      // Week 2 is mint-only; REDEEM is union-ready and lands in W3.
      { value: 'REDEEM', label: 'Redeem', disabled: true, disabledHint: 'Week 3+' },
    ],
  },
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'WAITING_FOR_PAYMENT', label: 'Waiting for payment' },
      { value: 'WAITING_FOR_APPROVAL', label: 'Waiting for approval' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'FAILED', label: 'Failed' },
    ],
  },
  {
    kind: 'select',
    key: 'paymentStatus',
    label: 'Payment',
    options: [
      { value: 'REQUESTED', label: 'Requested' },
      { value: 'WAITING_FOR_PAYMENT', label: 'Waiting for payment' },
      { value: 'PAID', label: 'Paid' },
      { value: 'EXPIRED', label: 'Expired' },
    ],
  },
  {
    kind: 'select',
    key: 'safeStatus',
    label: 'Safe',
    options: [
      { value: 'NONE', label: 'None' },
      { value: 'PENDING_APPROVAL', label: 'Pending approval' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'EXECUTED', label: 'Executed' },
      { value: 'REJECTED', label: 'Rejected' },
    ],
  },
]

// Column ids must match the `accessorKey` / `id` on the TanStack ColumnDef in
// TransactionsListPage.
export const ORDER_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'createdAt', label: 'Date', required: true },
  { key: 'type', label: 'Type' },
  { key: 'user', label: 'User', required: true },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'totalPayIdr', label: 'Total pay (IDR)' },
  { key: 'chain', label: 'Chain' },
  { key: 'paymentStatus', label: 'Payment' },
  { key: 'safeStatus', label: 'Safe' },
  { key: 'status', label: 'Status' },
]
