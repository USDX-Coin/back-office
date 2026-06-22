// USDX-206 + USDX-245 — filter + column config for the User Transaction list.
// sot/api/orders.yaml § list params: type / status / paymentStatus / safeStatus
// / userId. No `search` or sort params in the contract, so the toolbar renders
// only the Filter + Columns popovers. `userId` is a programmatic (deep-link)
// filter — not surfaced as a visible control.
import type { ColumnConfig, FilterDef, FilterOption } from '@/components/table/types'

const TYPE_OPTIONS: FilterOption[] = [
  { value: 'MINT', label: 'Mint' },
  // Redeem becomes effective in W3 (USDX-245) — the endpoint is union mint+redeem.
  { value: 'REDEEM', label: 'Redeem' },
]

// sot/api/common.yaml § MintOrderStatus.
const MINT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'WAITING_FOR_PAYMENT', label: 'Waiting for payment' },
  { value: 'WAITING_FOR_APPROVAL', label: 'Waiting for approval' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
]

// sot/api/common.yaml § RedeemStatus — redeem has its own single-dimension
// lifecycle (no payment / Safe legs).
const REDEEM_STATUS_OPTIONS: FilterOption[] = [
  { value: 'AWAITING_BURN', label: 'Awaiting burn' },
  { value: 'BURNED', label: 'Burned' },
  { value: 'PROCESSING_PAYOUT', label: 'Processing payout' },
  { value: 'PAYOUT_COMPLETE', label: 'Payout complete' },
  { value: 'EXPIRED', label: 'Expired' },
]

const PAYMENT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'WAITING_FOR_PAYMENT', label: 'Waiting for payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'EXPIRED', label: 'Expired' },
]

const SAFE_STATUS_OPTIONS: FilterOption[] = [
  { value: 'NONE', label: 'None' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'EXECUTED', label: 'Executed' },
  { value: 'REJECTED', label: 'Rejected' },
]

// Filter defs are contextual on the selected `type` (decision 2026-06-22):
//  - REDEEM → Status offers RedeemStatus; Payment/Safe filters drop out
//    (redeem has no payment/Safe leg — orders.yaml marks them MINT-only).
//  - MINT / all → Status offers MintOrderStatus + Payment + Safe filters.
// Note: orders.yaml types the `status` param as MintOrderStatus; surfacing
// RedeemStatus here is intentional drift, documented for PM.
export function buildOrderFilterDefs(type: string): FilterDef[] {
  const isRedeem = type === 'REDEEM'
  const defs: FilterDef[] = [
    { kind: 'select', key: 'type', label: 'Type', options: TYPE_OPTIONS },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      options: isRedeem ? REDEEM_STATUS_OPTIONS : MINT_STATUS_OPTIONS,
    },
  ]
  if (!isRedeem) {
    defs.push(
      { kind: 'select', key: 'paymentStatus', label: 'Payment', options: PAYMENT_STATUS_OPTIONS },
      { kind: 'select', key: 'safeStatus', label: 'Safe', options: SAFE_STATUS_OPTIONS },
    )
  }
  return defs
}

// Default (type unset) = mint-shaped toolbar, matching the W2 contract surface.
export const ORDER_FILTER_DEFS: FilterDef[] = buildOrderFilterDefs('')

// Column ids must match the `accessorKey` / `id` on the TanStack ColumnDef in
// TransactionsListPage. `totalPayIdr` (mint) + `netPayoutIdr` (redeem) are the
// per-type IDR figures — each shows "—" for the other type.
export const ORDER_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'createdAt', label: 'Date', required: true },
  { key: 'type', label: 'Type' },
  { key: 'user', label: 'User', required: true },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'totalPayIdr', label: 'Total pay (IDR)' },
  { key: 'netPayoutIdr', label: 'Net payout (IDR)' },
  { key: 'chain', label: 'Chain' },
  { key: 'paymentStatus', label: 'Payment' },
  { key: 'safeStatus', label: 'Safe' },
  { key: 'status', label: 'Status' },
]
