import { useQuery } from '@tanstack/react-query'
import { apiFetchRaw } from '@/lib/apiFetch'
import type { PhaseOnePaginatedResponse } from '@/lib/types'
import type { ActivityLogEntry, ActivityLogFilters } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Jejak Audit — `GET /api/v1/activity-logs`, ADMIN saja
// (`backend/src/modules/activity-log/activity-log.controller.ts`).
//
// TIDAK ADA MUTASI DI SINI, DAN TIDAK BOLEH ADA. Controller-nya sengaja hanya
// punya `@Get()`; repository-nya sengaja hanya punya INSERT + SELECT; dan
// database menolak UPDATE/DELETE lewat trigger `activity_log_no_mutate`
// (migrasi 0045). Kalau suatu saat ada yang menambahkan `useMutation` di berkas
// ini, tiga lapisan itu sudah dilanggar sebelum barisnya sempat dikirim.
//
// Tanpa refetch saat jendela kembali fokus: halaman ini dibuka pemeriksa yang
// sedang membaca satu layar hasil, dan daftar yang bergeser sendiri di bawah
// kursornya mengubah baris yang sedang ia salin.
// ─────────────────────────────────────────────────────────────────────────────

const LOGS_PATH = '/api/v1/activity-logs'

export function buildActivityLogQuery(filters: ActivityLogFilters): string {
  const sp = new URLSearchParams()
  if (filters.page !== undefined) sp.set('page', String(filters.page))
  if (filters.take !== undefined) sp.set('take', String(filters.take))
  if (filters.action) sp.set('action', filters.action)
  if (filters.resourceType) sp.set('resourceType', filters.resourceType)
  if (filters.outcome) sp.set('outcome', filters.outcome)
  if (filters.actorStaffId) sp.set('actorStaffId', filters.actorStaffId)
  if (filters.actorUserId) sp.set('actorUserId', filters.actorUserId)
  // Dikirim APA ADANYA — pemanggil yang menstempel `+07:00` lewat `wibDayStartIso`
  // / `wibDayEndIso`. Menstempelnya di sini akan menyembunyikan aturan zona di
  // pembangun query, tempat orang tidak akan mencarinya.
  if (filters.from) sp.set('from', filters.from)
  if (filters.to) sp.set('to', filters.to)
  return sp.toString()
}

export function useActivityLogs(filters: ActivityLogFilters) {
  return useQuery({
    queryKey: ['activity-logs', 'list', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<ActivityLogEntry>>(
        `${LOGS_PATH}?${buildActivityLogQuery(filters)}`
      ),
    refetchOnWindowFocus: false,
  })
}
