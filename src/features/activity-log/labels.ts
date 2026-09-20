import type { StatusConfig } from '@/lib/status'
import type { ActivityOutcome } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Menerjemahkan isi `activity_log` ke bahasa yang dibaca pemeriksa.
//
// ATURAN YANG DIPEGANG DI SELURUH BERKAS INI: kode mesin TIDAK PERNAH DIBUANG.
// Ia boleh diberi terjemahan di sebelahnya, boleh dipindah ke "Detail teknis",
// tapi nilai yang tersimpan di tabel harus tetap bisa dikutip apa adanya — itu
// yang disalin pemeriksa ke dalam temuannya.
//
// Peta di bawah hanya berisi nilai yang BENAR-BENAR ditulis backend hari ini
// (hasil `grep 'action: "'` / `'resourceType: "'` di `backend/src`). Nilai di
// luar peta dirender mentah, bukan ditebak.
// ─────────────────────────────────────────────────────────────────────────────

/** `POST /api/v1/users/:id` → { method, path }. Null untuk kode eksplisit. */
export function parseRouteAction(action: string): { method: string; path: string } | null {
  const match = /^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*)$/.exec(action)
  return match ? { method: match[1]!, path: match[2]! } : null
}

/**
 * Kode aksi eksplisit yang ditulis service (bukan interseptor). Diturunkan dari
 * kode backend, bukan dikarang — yang tidak ada di sini dirender apa adanya.
 */
const EXPLICIT_ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN_FAILED: 'Login gagal',
  AUTH_LOGOUT: 'Logout',
  AUTH_PASSWORD_CHANGED: 'Kata sandi diganti',
  AUTH_PASSWORD_CHANGE_FAILED: 'Ganti kata sandi gagal',
  AUTH_CHECKOUT_HANDOFF_ISSUED: 'Tiket serah-terima checkout diterbitkan',
  AUTH_CHECKOUT_HANDOFF_EXCHANGED: 'Tiket serah-terima checkout ditukar',
  AUTH_CHECKOUT_HANDOFF_EXCHANGE_FAILED: 'Tukar tiket serah-terima checkout gagal',
  APPROVAL_REQUESTED: 'Usulan orang kedua dibuat',
  APPROVAL_GRANTED: 'Usulan disetujui',
  APPROVAL_REJECTED: 'Usulan ditolak',
  APPROVAL_EXECUTED: 'Aksi yang disetujui dijalankan',
  APPROVAL_EXECUTION_FAILED: 'Aksi yang disetujui GAGAL dijalankan',
  APPROVAL_EXPIRED: 'Usulan kedaluwarsa',
  APPROVAL_SELF_APPROVAL_BLOCKED: 'Percobaan menyetujui usulan sendiri — ditolak',
  PAYOUT_BRAKE_PULLED: 'Rem pencairan ditarik',
  ACCOUNT_DELETED: 'Akun nasabah dihapus',
  ACCOUNT_DELETE_FAILED: 'Hapus akun nasabah gagal',
  ACCOUNT_EXPORTED: 'Data akun nasabah diekspor',
  CDD_COMPLETED: 'Uji tuntas berkelanjutan (CDD) selesai',
}

/** Terjemahan aksi, atau `null` kalau memang belum ada — pemanggil merender kodenya. */
export function explicitActionLabel(action: string): string | null {
  return EXPLICIT_ACTION_LABELS[action] ?? null
}

/** Kata kerja untuk method HTTP, supaya baris terbaca tanpa tahu istilah REST. */
const METHOD_VERBS: Record<string, string> = {
  POST: 'Buat / jalankan',
  PUT: 'Ganti',
  PATCH: 'Ubah',
  DELETE: 'Hapus',
  GET: 'Baca',
}

export function methodVerb(method: string): string {
  return METHOD_VERBS[method] ?? method
}

/**
 * Kelompok objek. Server menurunkannya dari segmen pertama setelah `/api/v1/`
 * (`activity-log.interceptor.ts`), jadi daftarnya tumbuh sendiri setiap ada
 * modul baru. Yang belum diterjemahkan dirender apa adanya.
 */
const RESOURCE_TYPE_LABELS: Record<string, string> = {
  AUTH: 'Masuk / keluar',
  USERS: 'Nasabah',
  USER: 'Nasabah',
  ACCOUNT: 'Akun nasabah',
  STAFF: 'Pengguna internal',
  KYC: 'Verifikasi perorangan',
  KYB: 'Verifikasi badan usaha',
  KYC_UBO: 'Pemilik manfaat (UBO)',
  SCREENING: 'Pemeriksaan daftar sanksi',
  MINT: 'Mint OTC',
  BURN: 'Burn OTC',
  REQUESTS: 'Request OTC',
  ORDERS: 'Order nasabah',
  MULTISIG: 'Antrean tanda tangan',
  MANUAL_SYNC: 'Perbaiki status nyangkut',
  RATE: 'Kurs',
  FEE_CONFIG: 'Biaya',
  THRESHOLD: 'Ambang multisig',
  MINT_MODE: 'Mode mint',
  ONCALL_CONTACTS: 'Kontak on-call',
  TRANSPARENCY: 'Cadangan & atestasi',
  BNI_ACCOUNTS: 'Rekening BNI',
  HELD_CREDITS: 'Mint bermasalah',
  PAYOUT_FAILURES: 'Pencairan bermasalah',
  REDEEM_APPROVALS: 'Persetujuan pencairan',
  REDEEM_APPROVAL_CONTROLS: 'Ambang persetujuan pencairan',
  REDEEM_ORDER: 'Order pencairan',
  PAYOUT_CONTROLS: 'Plafon & rem pencairan',
  APPROVALS: 'Persetujuan orang kedua',
  REPORT_EXPORT: 'Ekspor laporan',
  PARTNER_CUSTOMER: 'Nasabah partner',
}

export function resourceTypeLabel(resourceType: string): string | null {
  return RESOURCE_TYPE_LABELS[resourceType] ?? null
}

/** Pilihan saringan "Kelompok objek" — hanya nilai yang punya terjemahan. */
export const RESOURCE_TYPE_OPTIONS = Object.entries(RESOURCE_TYPE_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label))

export const OUTCOME_OPTIONS = [
  { value: 'SUCCESS', label: 'Berhasil' },
  { value: 'FAILED', label: 'Gagal' },
]

export function outcomePill(outcome: ActivityOutcome): StatusConfig {
  if (outcome === 'SUCCESS') {
    return {
      label: 'Berhasil',
      variant: 'default',
      className: 'bg-success/10 text-success',
      dotClass: 'bg-success',
    }
  }
  return {
    label: 'Gagal',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  }
}

/**
 * Kenapa sebuah aksi gagal, sejauh yang bisa dikatakan kode HTTP-nya. Ini SATU
 * -SATUNYA petunjuk sebab di tabel: `activity_log` tidak menyimpan pesan galat
 * (alasan penolakan KYC, misalnya, hidup di `kyc_reviews.reason`).
 */
export function httpStatusMeaning(status: number | null): string | null {
  if (status === null) return null
  // Sengaja pendek: ini baris KEDUA di sel yang sempit, dan kalimat panjang di
  // sana terpotong justru di bagian yang membedakan satu sebab dari sebab lain
  // ("…peran tidak berwena…"). Kode HTTP mentahnya tetap ada di Detail teknis.
  if (status === 400 || status === 422) return 'Isian tidak sah'
  if (status === 401) return 'Sesi tidak sah'
  if (status === 403) return 'Peran tak berwenang'
  if (status === 404) return 'Objek tidak ditemukan'
  if (status === 409) return 'Keadaan tidak mengizinkan'
  if (status >= 500) return 'Server gagal'
  return null
}
