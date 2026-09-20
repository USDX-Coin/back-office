import type { Staff, StaffRole } from '@/lib/types'

/**
 * `GET /api/v1/activity-logs` adalah `@Roles("ADMIN")` — satu-satunya peran,
 * ditulis di `backend/src/modules/activity-log/activity-log.controller.ts`.
 *
 * Ditegakkan DI ROUTE (`App.tsx`), bukan cuma dengan menyembunyikan menu: menu
 * yang muncul lalu dijawab 403 adalah cara tercepat membuat orang mengira
 * layarnya rusak, dan halamannya toh tinggal satu URL jauhnya.
 *
 * Gagal TERTUTUP saat sesi belum termuat (`staff === null`).
 */
export function canReadActivityLog(staff: Staff | null): boolean {
  return staff?.role === 'ADMIN'
}

/** Bentuk per-peran, untuk handler MSW yang menegakkan gerbang yang sama. */
export function canReadActivityLogRole(role: StaffRole): boolean {
  return role === 'ADMIN'
}
