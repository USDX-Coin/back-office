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
  AUTH_LOGIN: 'Login berhasil',
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
  AUTH_PASSWORD_RESET_REQUESTED: 'Minta setel ulang kata sandi',
  AUTH_PASSWORD_RESET: 'Kata sandi disetel ulang',
  AUTH_PIN_FAILED: 'PIN salah',
  AUTH_PIN_LOCKED: 'PIN terkunci',
  AUTH_2FA_DISABLED: 'Verifikasi dua langkah dimatikan',
  AUTH_2FA_BACKUP_REGENERATED: 'Kode cadangan dua langkah dibuat ulang',
  AUTH_2FA_FAILED: 'Verifikasi dua langkah gagal',
  AUTH_SESSION_REVOKED: 'Satu sesi dicabut',
  AUTH_SESSIONS_REVOKED_OTHERS: 'Semua sesi lain dicabut',
  BNI_BALANCE_INQUIRY: 'Cek saldo rekening BNI',
  BNI_STATEMENT_INQUIRY: 'Tarik mutasi rekening BNI',
  MINT_MODE_TEST_ENABLED: 'Mode mint UJI dinyalakan',
  MINT_MODE_PROD_RESTORED: 'Mode mint dikembalikan ke PRODUKSI',
  REDEEM_APPROVAL_THRESHOLD_UPDATED: 'Ambang persetujuan pencairan diubah',
  REDEEM_PAYOUT_APPROVED: 'Pencairan disetujui',
  REDEEM_PAYOUT_REJECTED: 'Pencairan ditolak',
  ONCALL_CONTACT_CREATED: 'Kontak on-call ditambahkan',
  ONCALL_CONTACT_UPDATED: 'Kontak on-call diubah',
  ONCALL_CONTACT_DELETED: 'Kontak on-call dihapus',
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
  // DUA ejaan untuk satu layar, dan dua-duanya benar-benar ditulis backend dari
  // jalur yang berbeda: interseptor menurunkan `MINT_MODE` dari segmen rute
  // `/api/v1/mint-mode`, sementara `mint-mode.service.ts` mencatat
  // `MINT_MODE_CONTROLS` secara eksplisit untuk MINT_MODE_TEST_ENABLED /
  // MINT_MODE_PROD_RESTORED. Satu perbuatan karena itu meninggalkan DUA baris.
  //
  // Keduanya wajib ada di sini. Saringan "Kelompok objek" hanya menerima SATU
  // nilai (`ListActivityLogsDto.resourceType` sebuah string), jadi ejaan yang
  // hilang berarti barisnya tidak bisa disaring sama sekali — dan labelnya
  // harus BERBEDA, karena dua pilihan bernama sama membuat operator mengira
  // salah satunya menampilkan semuanya.
  MINT_MODE_CONTROLS: 'Mode mint — pergantian mode',
  ONCALL_CONTACTS: 'Kontak on-call',
  TRANSPARENCY: 'Cadangan & atestasi',
  BNI_ACCOUNTS: 'Rekening BNI',
  // Sama seperti MINT_MODE di atas: interseptor menulis `BNI_ACCOUNTS` (dari
  // rute), `bni-accounts.service.ts` menulis `BNI_ACCOUNT` (eksplisit) untuk
  // setiap BNI_BALANCE_INQUIRY / BNI_STATEMENT_INQUIRY — yaitu SELURUH baris
  // pembacaan saldo dan mutasi, yang sebelumnya tidak bisa disaring.
  BNI_ACCOUNT: 'Rekening BNI — cek saldo & mutasi',
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

/**
 * Nilai yang PUNYA terjemahan tapi TIDAK ditawarkan sebagai saringan.
 *
 * Keempatnya hanya ditulis ke `pii_access_audit`, bukan ke `activity_log`, dan
 * `GET /api/v1/activity-logs` membaca `activity_log` saja. Menawarkannya
 * sebagai pilihan berarti memberi pemeriksa saringan yang SELALU menjawab
 * "tidak ada" — jawaban yang bentuknya sama persis dengan "sudah dicek, memang
 * tidak ada", dan itu kesimpulan yang salah pada layar bukti kepatuhan.
 *
 * Terjemahannya TETAP ada di peta: kalau suatu hari nilai itu benar-benar
 * muncul di `activity_log`, barisnya tetap terbaca, tidak jatuh ke kode mentah.
 * (`USER` juga berlabel sama dengan `USERS` — dua pilihan bernama "Nasabah"
 * terbaca sebagai satu pilihan yang diduplikasi.)
 */
const HANYA_DI_PII_ACCESS_AUDIT = new Set([
  'USER',
  'KYC_UBO',
  'REPORT_EXPORT',
  'PARTNER_CUSTOMER',
])

/** Pilihan saringan "Kelompok objek" — nilai yang benar-benar bisa muncul. */
export const RESOURCE_TYPE_OPTIONS = Object.entries(RESOURCE_TYPE_LABELS)
  .filter(([value]) => !HANYA_DI_PII_ACCESS_AUDIT.has(value))
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
