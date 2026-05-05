import type { StaffRole } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Role → amount-threshold mapping for backoffice mint/burn submissions.
//
// SoT: sot/phase-1.md L17 + L25 — staff bisa proses < 1 milyar IDR; manager
// bisa proses semua amount. ("1M IDR" di L25/conventions.md L131 dibaca
// sebagai "1 milyar" — Indonesian shorthand; PR table mencatat ini sebagai
// koreksi SoT yang ditunggu PM.)
//
// NOTE — interim role mapping:
//   SoT phase-1.md L24 mendefinisikan role: Staff / Manager / Developer / Admin.
//   Mock saat ini pakai enum berbeda (support / operations / compliance /
//   super_admin). Saat enum reconciled (ticket terpisah, lihat PR), satu-
//   satunya tempat yang harus diubah adalah tabel `ROLE_CAN_HANDLE_LARGE`
//   di bawah — call sites + tests + handler logic stable.
// ─────────────────────────────────────────────────────────────────────────────

export const STAFF_AMOUNT_THRESHOLD_IDR = 1_000_000_000

const ROLE_CAN_HANDLE_LARGE: Record<StaffRole, boolean> = {
  super_admin: true, // → Manager-equivalent (interim)
  operations: false, // → Staff-equivalent
  compliance: false, // → Staff-equivalent
  support: false, // → Staff-equivalent
}

export function canHandleAmountIdr(role: StaffRole, amountIdr: number): boolean {
  if (amountIdr < STAFF_AMOUNT_THRESHOLD_IDR) return true
  return ROLE_CAN_HANDLE_LARGE[role] ?? false
}
