import type { StaffRole } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Role → amount-threshold mapping for backoffice mint/burn submissions.
//
// SoT: sot/phase-1.md L17 + L25 — staff bisa proses < 1 milyar IDR; manager
// bisa proses semua amount.
// ─────────────────────────────────────────────────────────────────────────────

export const STAFF_AMOUNT_THRESHOLD_IDR = 1_000_000_000

const ROLE_CAN_HANDLE_LARGE: Record<StaffRole, boolean> = {
  ADMIN: true,
  MANAGER: true,
  STAFF: false,
  DEVELOPER: false,
}

export function canHandleAmountIdr(role: StaffRole, amountIdr: number): boolean {
  if (amountIdr < STAFF_AMOUNT_THRESHOLD_IDR) return true
  return ROLE_CAN_HANDLE_LARGE[role] ?? false
}
