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
 * `from`/`to` sekarang ADA di sana (branch backend
 * `wisnubarata111/be-badge-antrean-dan-rentang-jejak`), dengan bentuk yang
 * sengaja disamakan persis dengan `ListDurianpayApiCallsDto`: `@IsISO8601()`,
 * keduanya opsional dan berdiri sendiri, dan **INKLUSIF di kedua ujung**.
 *
 * Yang MASIH belum diterima: `resourceId`. Dan itu tetap bukan kelalaian kita —
 * `createGlobalValidationPipe` memakai `whitelist: true` TANPA
 * `forbidNonWhitelisted`, jadi parameter yang tidak dikenal DIBUANG DIAM-DIAM.
 * Saringan id objek yang dikirim ke endpoint ini akan tampak bekerja sambil
 * mengembalikan SELURUH isi tabel — hasil yang terbaca seperti pencarian yang
 * berhasil, di layar yang dibuka justru saat pemeriksa bertanya. Karena itu
 * layar ini tidak punya isian id objek; lihat catatan di `ActivityLogPage`.
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
  /**
   * Batas bawah rentang waktu kejadian, INKLUSIF, ISO-8601 **berpenanda zona**.
   * Tanggal telanjang (`2026-09-12`) dibaca server sebagai 07:00 WIB dan
   * membuang tujuh jam kejadian pagi — `wibDayStartIso` yang menstempelnya.
   */
  from?: string
  /** Batas atas, INKLUSIF (`lte` di server). Lihat `wibDayEndIso`. */
  to?: string
}
