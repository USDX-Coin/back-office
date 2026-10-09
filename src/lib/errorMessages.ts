import { ApiError } from './apiFetch'

/**
 * Peta galat API → kalimat manusia, TERPUSAT (revisi PM 9 Okt 2026).
 *
 * Masalah yang diperbaiki: layar menampilkan kode mentah dari server
 * (`INVALID_CREDENTIALS (UNAUTHORIZED)`, pesan Inggris, `Internal server
 * error`) di depan operator. Kode itu tetap berharga — itulah yang dikutip
 * saat melapor ke tim teknis — jadi ia TIDAK dibuang, melainkan dipindah ke
 * `technical` (ditampilkan di "Detail teknis", lihat `components/ErrorNotice`).
 *
 * Urutan pencarian kalimat:
 *   1. peta khusus pemanggil (`overrides`) per kode,
 *   2. peta umum per kode (`KODE`),
 *   3. peta per status HTTP (`STATUS`),
 *   4. kalimat cadangan pemanggil.
 *
 * Pesan server TIDAK pernah jadi kalimat utama di sini: ia bisa berbahasa
 * Inggris, berupa kode, atau membawa detail internal. Pemanggil yang memang
 * WAJIB menampilkan pesan server apa adanya (mis. 422 mode uji mint, galat
 * per-field biaya) menanganinya sendiri — terdokumentasi di CLAUDE.md.
 */

const KODE: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email atau kata sandi salah. Periksa lalu coba lagi.',
  ACCOUNT_LOCKED: 'Akun ini dikunci sementara karena terlalu banyak percobaan. Coba lagi nanti atau hubungi Admin.',
  ACCOUNT_INACTIVE: 'Akun ini sudah dinonaktifkan. Hubungi Admin.',
  STAFF_INACTIVE: 'Akun ini sudah dinonaktifkan. Hubungi Admin.',
  SESSION_EXPIRED: 'Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.',
  UNAUTHORIZED: 'Sesi kamu sudah berakhir. Masuk lagi untuk melanjutkan.',
  FORBIDDEN: 'Peranmu tidak punya izin untuk tindakan ini.',
  NOT_FOUND: 'Data yang diminta tidak ditemukan. Mungkin sudah dihapus atau dipindah.',
  VALIDATION_ERROR: 'Ada isian yang ditolak server. Periksa kembali isiannya.',
  BAD_REQUEST: 'Permintaan ditolak server. Periksa kembali isiannya.',
  CONFLICT: 'Datanya sudah berubah sejak terakhir dimuat. Muat ulang lalu coba lagi.',
  RATE_LIMITED: 'Terlalu sering. Tunggu sebentar lalu coba lagi.',
  TOO_MANY_ATTEMPTS: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
  TOO_MANY_REQUESTS: 'Terlalu sering. Tunggu sebentar lalu coba lagi.',
  INTERNAL_ERROR: 'Server sedang bermasalah. Coba lagi sebentar lagi; kalau berulang, laporkan ke tim teknis.',
  INTERNAL_SERVER_ERROR: 'Server sedang bermasalah. Coba lagi sebentar lagi; kalau berulang, laporkan ke tim teknis.',
  SERVICE_UNAVAILABLE: 'Layanan ini sedang tidak tersedia. Coba lagi sebentar lagi.',
  NOT_IMPLEMENTED: 'Fitur ini belum aktif di server.',
  EMAIL_ALREADY_REGISTERED: 'Email ini sudah terdaftar untuk nasabah lain. Pakai email lain.',
  PHONE_ALREADY_REGISTERED: 'Nomor HP ini sudah terdaftar untuk nasabah lain. Pakai nomor lain.',
  WALLET_ALREADY_EXISTS: 'Alamat wallet ini sudah terdaftar. Periksa lagi alamatnya.',
  ONCALL_CONTACT_ALREADY_EXISTS: 'Kontak dengan kanal dan nilai ini sudah terdaftar. Ubah kontak yang sudah ada, atau pakai nilai lain.',
  SAFE_QUEUE_OCCUPIED: 'Antrean tanda tangan Safe sedang terisi transaksi lain. Selesaikan atau batalkan dulu yang itu.',
}

const STATUS: Record<number, string> = {
  400: KODE.BAD_REQUEST!,
  401: KODE.UNAUTHORIZED!,
  403: KODE.FORBIDDEN!,
  404: KODE.NOT_FOUND!,
  409: KODE.CONFLICT!,
  422: KODE.VALIDATION_ERROR!,
  429: KODE.RATE_LIMITED!,
  500: KODE.INTERNAL_ERROR!,
  501: KODE.NOT_IMPLEMENTED!,
  502: 'Server tidak menjawab dengan benar. Coba lagi sebentar lagi.',
  503: KODE.SERVICE_UNAVAILABLE!,
  504: 'Server terlalu lama menjawab. Coba lagi sebentar lagi.',
}

export const PESAN_JARINGAN = 'Server tidak bisa dihubungi. Periksa koneksi internet lalu coba lagi.'
export const PESAN_CADANGAN = 'Permintaan gagal. Coba lagi sebentar lagi.'

export interface HumanError {
  /** Kalimat untuk operator — bahasa Indonesia, tanpa kode. */
  message: string
  /** Bahan "Detail teknis": kode · HTTP · pesan server. `null` bila tidak ada. */
  technical: string | null
}

/** Pesan yang jelas-jelas bukan kalimat manusia: kode HURUF_BESAR atau kosong. */
function looksLikeCode(s: string): boolean {
  return /^[A-Z0-9_]+(\s*\([A-Z0-9_]+\))?$/.test(s.trim())
}

/**
 * `fetch` melempar TypeError saat permintaan tidak pernah sampai ke server
 * (jaringan mati, DNS, CORS) — itu bukan salah isian operator.
 */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.name === 'AbortError')
}

export function humanizeError(
  err: unknown,
  opts: { fallback?: string; overrides?: Record<string, string> } = {},
): HumanError {
  const fallback = opts.fallback ?? PESAN_CADANGAN
  if (err instanceof ApiError) {
    const parts = [
      err.code && err.code !== 'UNKNOWN' ? err.code : null,
      err.status ? `HTTP ${err.status}` : null,
      err.message.trim() && err.message.trim() !== err.code ? err.message.trim() : null,
    ].filter(Boolean)
    // Sebagian backend menaruh kode bernama di `message` (ConflictException("X")
    // → `{ code: 'CONFLICT', message: 'X' }`) — dibaca dari keduanya.
    const named = [err.code, err.message.trim()].find(
      (c) => c && (opts.overrides?.[c] ?? KODE[c]),
    )
    const message =
      (named && (opts.overrides?.[named] ?? KODE[named])) ?? STATUS[err.status] ?? fallback
    return { message, technical: parts.length ? parts.join(' · ') : null }
  }
  if (isNetworkError(err)) {
    const detail = err instanceof Error && err.message.trim() ? err.message.trim() : null
    return { message: PESAN_JARINGAN, technical: detail }
  }
  if (err instanceof Error) {
    const m = err.message.trim()
    // Galat biasa yang ditulis kode kita sendiri (kalimat Indonesia) boleh lewat;
    // yang terlihat seperti kode mentah dipindah ke detail teknis.
    if (m && !looksLikeCode(m)) return { message: m, technical: null }
    return { message: fallback, technical: m || null }
  }
  return { message: fallback, technical: null }
}

/** Kalimatnya saja — untuk toast dan teks satu baris. */
export function errorMessage(err: unknown, fallback?: string): string {
  return humanizeError(err, { fallback }).message
}
