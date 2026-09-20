// Kontrak `GET /api/v1/activity-logs` (USDX-355 / USDX-360).
//
// Bentuknya BARIS TABEL APA ADANYA: `ActivityLogService.list` mengembalikan
// `ActivityLogRow` = `typeof activityLog.$inferSelect` tanpa lapisan penyaji
// (`backend/src/modules/activity-log/activity-log.service.ts`). Jadi tidak ada
// nama staf, tidak ada label, tidak ada apa pun yang sudah diterjemahkan —
// semuanya dikerjakan di layar ini.

export type ActivityOutcome = 'SUCCESS' | 'FAILED'

export interface ActivityLogEntry {
  id: string
  /** Staf yang melakukan aksi. Null untuk event konsumen / login gagal. */
  actorStaffId: string | null
  /** Konsumen yang jadi aktor event auth v2 (login/logout/reset). */
  actorUserId: string | null
  /** `POST /api/v1/users/:id` (mutasi ter-intercept) atau `AUTH_LOGIN_FAILED`. */
  action: string
  /** Kelompok resource: `USERS`, `KYC`, `AUTH`, … Text bebas di server. */
  resourceType: string
  /** Id objek yang dikenai aksi (route param `:id`). Bisa non-UUID. */
  resourceId: string | null
  /** Konteks tersanitasi — route params, audience, email ter-mask. Tanpa body. */
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  outcome: ActivityOutcome
  httpStatus: number | null
  createdAt: string
}

/**
 * Saringan yang BENAR-BENAR diterima server (`ListActivityLogsDto`).
 *
 * Tidak ada `from`/`to` dan tidak ada `resourceId` di sana, dan itu bukan
 * kelalaian kita: `createGlobalValidationPipe` memakai `whitelist: true` TANPA
 * `forbidNonWhitelisted`, jadi parameter yang tidak dikenal DIBUANG DIAM-DIAM —
 * sebuah saringan tanggal yang dikirim ke endpoint ini akan tampak bekerja dan
 * mengembalikan seluruh isi tabel. Karena itu layar ini tidak punya isian
 * tanggal sama sekali; lihat catatan di `ActivityLogPage`.
 */
export interface ActivityLogFilters {
  page?: number
  /** Nama parameter kontraknya `take` (cap 100); jawabannya `metadata.limit`. */
  take?: number
  /** Pencocokan PERSIS (`eq`), bukan pencarian sebagian. */
  action?: string
  /** Pencocokan PERSIS (`eq`). */
  resourceType?: string
  outcome?: ActivityOutcome
  actorStaffId?: string
  actorUserId?: string
}
