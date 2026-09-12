// Multisig SafeTx status + activity UI helpers (USDX-275).
// sot/api/multisig.yaml § SafeTxStatus / SafeActivity + week4.md § Lifecycle.
// Pure functions — no React. Colors follow the warning→primary→success→
// destructive convention used by src/lib/status.ts.

import type { SafeActivity, SafeTxStatus } from '@/lib/types'
import type { StatusConfig } from '@/lib/status'

const safeTxStatusMap: Record<SafeTxStatus, StatusConfig> = {
  PENDING_SIGN: {
    label: 'Pending sign',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  READY_TO_EXECUTE: {
    label: 'Ready to execute',
    variant: 'outline',
    className: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary',
  },
  CONFIRMING: {
    // In-flight on-chain (execTransaction broadcast, awaiting confirmations) —
    // cyan accent (Azure Horizon primary-container) to read as "in progress".
    label: 'Confirming',
    variant: 'outline',
    className: 'bg-[#1eaed5]/12 text-[#067d99]',
    dotClass: 'bg-[#1eaed5]',
  },
  EXECUTED: {
    label: 'Executed',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  FAILED: {
    label: 'Failed',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'outline',
    className: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  },
}

export function getSafeTxStatusConfig(status: SafeTxStatus): StatusConfig {
  return (
    safeTxStatusMap[status] ?? {
      label: String(status),
      variant: 'outline',
      className: '',
      dotClass: 'bg-muted-foreground',
    }
  )
}

// Terminal states stop the queue polling. CANCELLED/EXECUTED/FAILED never move.
export function isSafeTxTerminal(status: SafeTxStatus): boolean {
  return status === 'EXECUTED' || status === 'FAILED' || status === 'CANCELLED'
}

// Lifecycle position. A SafeTx only ever moves FORWARD — collecting signatures,
// then executable, then broadcast, then settled. Nothing in multisig.yaml walks
// one backwards (a signature is never withdrawn), which is what makes the
// reconciliation below sound.
const safeTxStatusOrderMap: Record<SafeTxStatus, number> = {
  PENDING_SIGN: 0,
  READY_TO_EXECUTE: 1,
  CONFIRMING: 2,
  // The three terminals share a rank: they're mutually exclusive endings, and
  // none is "more advanced" than another.
  EXECUTED: 3,
  FAILED: 3,
  CANCELLED: 3,
}

export function safeTxStatusOrder(status: SafeTxStatus): number {
  return safeTxStatusOrderMap[status] ?? 0
}

/**
 * Reconcile two independently-fetched views of the SAME transaction.
 *
 * The queue list and the detail drawer are separate queries on separate poll
 * clocks, so they routinely disagree by a few seconds. Because a SafeTx only
 * moves forward, the more advanced of the two is the true one — and the UI must
 * follow the true one, not whichever query happens to be older. Without this,
 * the drawer offered "Connect wallet" + "Sign (EIP-712)" on a transaction the
 * row behind it already showed as Confirming.
 *
 * `primary` wins ties, so an absent/equal second opinion changes nothing.
 */
export function mostAdvancedSafeTxStatus(
  primary: SafeTxStatus,
  other: SafeTxStatus | null | undefined,
): SafeTxStatus {
  if (!other) return primary
  return safeTxStatusOrder(other) > safeTxStatusOrder(primary) ? other : primary
}

// A SafeTx accepts more signatures only while collecting / not yet executed
// (multisig.yaml confirm 409 SAFE_TX_NOT_SIGNABLE: only PENDING_SIGN /
// READY_TO_EXECUTE). READY_TO_EXECUTE stays signable so extra owners can add
// signatures before someone executes.
export function isSafeTxSignable(status: SafeTxStatus): boolean {
  return status === 'PENDING_SIGN' || status === 'READY_TO_EXECUTE'
}

// Cancel is a pre-execution discard (off-chain): only PENDING_SIGN /
// READY_TO_EXECUTE (multisig.yaml cancel 409 SAFE_TX_NOT_CANCELLABLE).
export function isSafeTxCancellable(status: SafeTxStatus): boolean {
  return status === 'PENDING_SIGN' || status === 'READY_TO_EXECUTE'
}

export function isSafeTxExecutable(status: SafeTxStatus): boolean {
  return status === 'READY_TO_EXECUTE'
}

// Queue tabs in the order shown in the reference UI (week4.md § Backoffice
// Multisig Page). `value` is the `status` filter sent to GET /api/v1/multisig
// (empty = All). CANCELLED has no dedicated tab (visible under All).
export interface SafeTxTab {
  value: '' | SafeTxStatus
  label: string
  /** Show a live "(N)" count next to the label (actionable / in-flight tabs). */
  showCount: boolean
}

export const SAFE_TX_TABS: SafeTxTab[] = [
  { value: '', label: 'All', showCount: false },
  { value: 'PENDING_SIGN', label: 'Pending Sign', showCount: true },
  { value: 'READY_TO_EXECUTE', label: 'Ready to Execute', showCount: true },
  { value: 'CONFIRMING', label: 'Confirming', showCount: true },
  { value: 'EXECUTED', label: 'Executed', showCount: false },
  { value: 'FAILED', label: 'Failed', showCount: false },
]

// Statuses that get a live count badge on their tab (the in-flight, actionable
// ones). Drives the lightweight per-status count queries.
export const SAFE_TX_COUNTED_STATUSES = SAFE_TX_TABS.filter((t) => t.showCount).map(
  (t) => t.value,
) as SafeTxStatus[]

// Fallback activity label when the backend `activityLabel` is empty. The decoded
// `activityLabel` is preferred; this just makes the enum human-readable.
const activityLabelMap: Record<SafeActivity, string> = {
  MINT: 'Mint',
  BURN: 'Burn',
  ADD_BLACKLIST: 'Add to blacklist',
  REMOVE_BLACKLIST: 'Remove from blacklist',
  DESTROY_FUNDS: 'Destroy funds',
  PAUSE: 'Pause',
  UNPAUSE: 'Unpause',
  SET_SUPPORTED_CHAIN: 'Set supported chain',
  GRANT_ROLE: 'Grant role',
  REVOKE_ROLE: 'Revoke role',
  MINT_BRIDGE: 'Mint (bridge)',
  TIMELOCK_SCHEDULE: 'Timelock schedule',
  TIMELOCK_EXECUTE: 'Timelock execute',
  UNKNOWN: 'Unknown',
}

export function getActivityLabel(activity: SafeActivity): string {
  return activityLabelMap[activity] ?? String(activity)
}

// Calldata the decoder couldn't resolve → never sign blind (week4.md guard).
export function isUnknownActivity(activity: SafeActivity): boolean {
  return activity === 'UNKNOWN'
}
