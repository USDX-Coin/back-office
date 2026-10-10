// Multisig SafeTx status + activity UI helpers (USDX-275).
// sot/api/multisig.yaml § SafeTxStatus / SafeActivity + week4.md § Lifecycle.
// Pure functions — no React. Colors follow the warning→primary→success→
// destructive convention used by src/lib/status.ts.

import type { SafeActivity, SafeTxStatus } from '@/lib/types'
import { unknownStatusLabel, type StatusConfig } from '@/lib/status'

const safeTxStatusMap: Record<SafeTxStatus, StatusConfig> = {
  PENDING_SIGN: {
    label: 'Menunggu tanda tangan',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  READY_TO_EXECUTE: {
    label: 'Siap dieksekusi',
    variant: 'outline',
    className: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary',
  },
  CONFIRMING: {
    // In-flight on-chain (execTransaction broadcast, awaiting confirmations) —
    // gold accent to read as "in progress", distinct from the maroon
    // READY_TO_EXECUTE badge. Token-based so it holds in dark mode too.
    label: 'Menunggu konfirmasi jaringan',
    variant: 'outline',
    className: 'bg-gold-soft text-gold-foreground',
    dotClass: 'bg-gold',
  },
  EXECUTED: {
    label: 'Sudah dieksekusi',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  FAILED: {
    label: 'Gagal',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
  CANCELLED: {
    label: 'Dibatalkan',
    variant: 'outline',
    className: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  },
}

export function getSafeTxStatusConfig(status: SafeTxStatus): StatusConfig {
  return (
    safeTxStatusMap[status] ?? {
      label: unknownStatusLabel(status),
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
  { value: '', label: 'Semua', showCount: false },
  { value: 'PENDING_SIGN', label: 'Menunggu Tanda Tangan', showCount: true },
  { value: 'READY_TO_EXECUTE', label: 'Siap Dieksekusi', showCount: true },
  { value: 'CONFIRMING', label: 'Menunggu Konfirmasi', showCount: true },
  { value: 'EXECUTED', label: 'Sudah Dieksekusi', showCount: false },
  { value: 'FAILED', label: 'Gagal', showCount: false },
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
  ADD_BLACKLIST: 'Tambah ke daftar blokir',
  REMOVE_BLACKLIST: 'Hapus dari daftar blokir',
  DESTROY_FUNDS: 'Musnahkan dana',
  PAUSE: 'Hentikan sementara',
  UNPAUSE: 'Jalankan kembali',
  SET_SUPPORTED_CHAIN: 'Atur jaringan yang didukung',
  GRANT_ROLE: 'Beri wewenang',
  REVOKE_ROLE: 'Cabut wewenang',
  MINT_BRIDGE: 'Mint lintas jaringan',
  TIMELOCK_SCHEDULE: 'Jadwalkan lewat timelock',
  TIMELOCK_EXECUTE: 'Jalankan jadwal timelock',
  // JANGAN diganti jadi kalimat yang menenangkan: calldata yang tidak bisa
  // dibaca decoder adalah justru yang tidak boleh ditandatangani buta.
  UNKNOWN: 'Tidak dikenali',
}

export function getActivityLabel(activity: SafeActivity): string {
  return activityLabelMap[activity] ?? String(activity)
}

// Calldata the decoder couldn't resolve → never sign blind (week4.md guard).
export function isUnknownActivity(activity: SafeActivity): boolean {
  return activity === 'UNKNOWN'
}
