import type { Staff, StaffRole } from '@/lib/types'

// Matriks peran `HeldCreditsController`, disalin apa adanya:
//
//   GET  list / detail — STAFF, MANAGER, ADMIN, DEVELOPER (Developer read-only)
//   POST resolve       — STAFF, MANAGER, ADMIN (Developer 403)
//
// Rutenya TIDAK digerbangi: antrean kerja terbuka, aksinya digerbangi di dalam
// layar, backend menegakkan 403 lagi — pola /kyc, /screening, /payout-failures.
//
// Perhatikan bahwa ini LEBIH LONGGAR daripada resolve pencairan bermasalah
// (MANAGER/ADMIN), dan itu memang beda kontraknya: yang ini mencocokkan uang
// MASUK ke order, yang itu mengeluarkan rupiah ke rekening nasabah.

export function canResolveHeldCredit(staff: Staff | null): boolean {
  return staff !== null && staff.role !== 'DEVELOPER'
}

export function canResolveHeldCreditRole(role: StaffRole): boolean {
  return role !== 'DEVELOPER'
}
