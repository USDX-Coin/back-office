/**
 * Aturan murni layar Persetujuan Pencairan (USDX-669, `sot/api/redeem-approvals.yaml`).
 *
 * Dua hal di berkas ini ada karena salah mengerjakannya mahal:
 *
 *  1. UANG TIDAK PERNAH LEWAT FLOAT. Kontraknya menyatakan tiap nominal sebagai
 *     string desimal di atas kolom `numeric(20,2)`. 20 digit tidak masuk ke JS
 *     number, dan `0.1 + 0.2` bukan `0.3`. Seluruh pembandingan dan pemformatan
 *     di bawah bekerja atas sen bulat dalam BigInt, jadi Rp 1 tidak pernah hilang
 *     karena pembulatan.
 *
 *     Tekniknya persis `@/lib/transparency` (`parseAmountToCents` /
 *     `centsToAmount`), dan SENGAJA tidak diimpor dari sana. Itu kontrak lain
 *     (`numeric(30,2)`, nominal boleh negatif, mata uang bebas) yang hari ini
 *     kebetulan sepakat soal dua desimal; menumpanginya berarti perubahan pada
 *     kontrak transparansi diam-diam memindahkan aturan uang gerbang payout.
 *     Preseden yang sama dipakai `canDecideScreening` vs `canReviewKyc`.
 *
 *  2. AMBANG `0` ADALAH KEADAAN PALING KETAT, BUKAN "MATI". `0` berarti SEMUA
 *     pencairan wajib disetujui manusia. Menaikkannya berarti rupiah sampai
 *     nominal itu mulai keluar tanpa satu pun manusia menyetujuinya. Salah paham
 *     ke arah "0 = gerbang mati" akan membuat operator menaikkan angka untuk
 *     "menyalakan" gerbang dan justru mematikannya — jadi arah perubahan
 *     dihitung di sini (`classifyThresholdChange`) dan dipakai layar untuk
 *     menuntut konfirmasi eksplisit sebelum gerbang dilonggarkan.
 */
import { ApiError } from './apiFetch'

// ─── Uang: string desimal ⇄ sen bulat (BigInt) ──────────────────────────────

/**
 * Bentuk yang diterima kontrak: `^\d+(\.\d{1,2})?$` — dua desimal, TANPA tanda.
 * Nominal payout tidak bisa negatif, dan ambang negatif tidak punya arti; menerima
 * `-` di sini hanya memindahkan penolakan ke server setelah operator menekan simpan.
 */
const IDR_2DP_RE = /^\d+(\.\d{1,2})?$/

/**
 * String desimal IDR → sen bulat. `null` untuk apa pun yang bukan nominal 2
 * desimal yang sah — pemanggil memutuskan apa yang dirender, kita tidak pernah
 * memaksa nominal tak terbaca menjadi 0. `0` yang dikarang di layar gerbang uang
 * berbunyi "semua wajib disetujui", kebalikan dari keadaan yang sebenarnya
 * belum diketahui.
 */
export function parseIdrToCents(raw: string): bigint | null {
  const value = raw.trim()
  if (!IDR_2DP_RE.test(value)) return null
  const [whole = '0', fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

/** Sen bulat → string desimal kontrak (`150000` → `"1500.00"`). */
export function centsToIdr(cents: bigint): string {
  const whole = cents / 100n
  const fraction = (cents % 100n).toString().padStart(2, '0')
  return `${whole}.${fraction}`
}

/** Kelompokkan digit ribuan dengan titik — dilakukan atas STRING, tidak pernah lewat Number. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * `"1500000.5"` → `"Rp 1.500.000,50"` (ejaan id-ID).
 *
 * Nominal yang tak terbaca dirender APA ADANYA (dengan prefiks `Rp`), bukan
 * sebagai `—` dan bukan sebagai `Rp 0`: operator harus melihat nilai yang
 * sesungguhnya dikirim backend supaya bisa melaporkannya, bukan tanda bahwa
 * layar ini memutuskan nilainya tidak ada.
 */
export function formatIdrExact(raw: string): string {
  const cents = parseIdrToCents(raw)
  if (cents === null) return `Rp ${raw}`
  const [whole = '0', fraction = '00'] = centsToIdr(cents).split('.')
  return `Rp ${groupThousands(whole)},${fraction}`
}

/**
 * `"100.000000"` → `"100 USDX"`, `"12.5"` → `"12,5 USDX"`.
 *
 * Nol di ujung desimal dibuang karena `100.000000 USDX` membuat operator
 * menghitung digit untuk memastikan itu seratus, bukan satu juta. Bagian bulat
 * tetap dikelompokkan. Seperti di atas: string masuk, string keluar, tanpa Number
 * — USDX 6 desimal dan `parseFloat` sudah cukup untuk menggeser satu satuan
 * terkecil pada nominal besar.
 */
export function formatUsdxExact(raw: string): string {
  const value = raw.trim()
  if (!/^\d+(\.\d+)?$/.test(value)) return `${raw} USDX`
  const [whole = '0', fraction = ''] = value.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const grouped = groupThousands(whole)
  return trimmed ? `${grouped},${trimmed} USDX` : `${grouped} USDX`
}

/** `true` kalau ambangnya `0` — SEMUA pencairan wajib disetujui manusia. */
export function holdsEveryPayout(approvalThresholdIdr: string): boolean {
  return parseIdrToCents(approvalThresholdIdr) === 0n
}

// ─── Arah perubahan ambang ──────────────────────────────────────────────────

/**
 * Apa yang sedang dilakukan operator terhadap gerbang.
 *
 * `raised-from-zero` dipisahkan dari `raised` karena ia satu-satunya perubahan
 * yang mengubah KATEGORI: dari "setiap rupiah dilihat manusia" menjadi "sebagian
 * rupiah tidak dilihat siapa pun". Kalimat konfirmasinya karena itu juga berbeda.
 */
export type ThresholdChange =
  | 'invalid'
  | 'unchanged'
  | 'raised-from-zero'
  | 'raised'
  | 'lowered'

export function classifyThresholdChange(
  current: string,
  next: string,
): ThresholdChange {
  const from = parseIdrToCents(current)
  const to = parseIdrToCents(next)
  if (from === null || to === null) return 'invalid'
  if (to === from) return 'unchanged'
  if (to < from) return 'lowered'
  return from === 0n ? 'raised-from-zero' : 'raised'
}

/**
 * Perubahan yang MELONGGARKAN gerbang wajib dikonfirmasi lebih dulu.
 *
 * AC tiket menuntutnya untuk kenaikan dari `0`. Ia diterapkan ke SETIAP kenaikan,
 * dan itu bukan pelonggaran AC melainkan superset-nya: naik dari Rp 1 juta ke
 * Rp 1 miliar juga melepas rupiah yang sebelumnya dilihat manusia, dan tidak ada
 * alasan kenaikan itu lebih ringan daripada kenaikan dari nol. Menurunkan ambang
 * (lebih banyak yang wajib disetujui) tidak pernah butuh konfirmasi —
 * mengetatkan tidak boleh lebih sulit daripada melonggarkan.
 */
export function requiresRaiseConfirmation(current: string, next: string): boolean {
  const change = classifyThresholdChange(current, next)
  return change === 'raised' || change === 'raised-from-zero'
}

// ─── Validasi isian ─────────────────────────────────────────────────────────

/** `minLength: 3` / `maxLength: 500` pada `reason` — alasan tolak DAN alasan ubah ambang. */
export const REDEEM_REASON_MIN = 3
export const REDEEM_REASON_MAX = 500

/** `maxLength: 500` pada catatan approve. Tidak ada batas bawah: catatannya opsional. */
export const APPROVE_NOTE_MAX = 500

type Validated<T> = { valid: true; value: T } | { valid: false; error: string }

/**
 * Alasan penolakan pencairan.
 *
 * Mengembalikan nilai yang sudah di-trim adalah intinya: pemanggil tidak bisa
 * tanpa sengaja mengirim `"   "`, yang lolos pemeriksaan panjang mentah tapi
 * kosong bagi manusia berikutnya yang membuka order ini di antrean "Pencairan
 * Bermasalah" — dan dialah satu-satunya pembaca alasan ini.
 *
 * Batasnya DISALIN dari kontrak (3..500), bukan diperketat sendiri. Aturan klien
 * yang lebih ketat daripada kontrak menolak masukan yang server terima, dan yang
 * menanggungnya operator yang tidak bisa menyelesaikan pekerjaannya.
 */
export function validateRejectReason(reason: string): Validated<string> {
  const trimmed = reason.trim()
  if (!trimmed) return { valid: false, error: 'Alasan penolakan wajib diisi' }
  if (trimmed.length < REDEEM_REASON_MIN) {
    return {
      valid: false,
      error: `Alasan minimal ${REDEEM_REASON_MIN} karakter — ia dibaca ops yang menuntaskan order ini`,
    }
  }
  if (trimmed.length > REDEEM_REASON_MAX) {
    return { valid: false, error: `Alasan maksimal ${REDEEM_REASON_MAX} karakter` }
  }
  return { valid: true, value: trimmed }
}

/**
 * Catatan opsional saat menyetujui. Kotak kosong sah; `undefined` dikirim supaya
 * `activity_log` tidak menyimpan string kosong yang tampak seperti catatan.
 */
export function validateApproveNote(note: string): Validated<string | undefined> {
  const trimmed = note.trim()
  if (!trimmed) return { valid: true, value: undefined }
  if (trimmed.length > APPROVE_NOTE_MAX) {
    return { valid: false, error: `Catatan maksimal ${APPROVE_NOTE_MAX} karakter` }
  }
  return { valid: true, value: trimmed }
}

/** Nominal ambang: bentuk `^\d+(\.\d{1,2})?$` persis seperti kontrak. */
export function validateThresholdAmount(raw: string): Validated<string> {
  const value = raw.trim()
  if (!value) return { valid: false, error: 'Ambang wajib diisi — tulis 0 kalau semua wajib disetujui' }
  if (parseIdrToCents(value) === null) {
    return {
      valid: false,
      error: 'Tulis nominal rupiah tanpa titik atau koma, maksimal 2 angka desimal (mis. 1000000 atau 1000000.50)',
    }
  }
  return { valid: true, value }
}

/** Alasan perubahan ambang — batas sama dengan alasan tolak (3..500). */
export function validateThresholdReason(reason: string): Validated<string> {
  const trimmed = reason.trim()
  if (!trimmed) return { valid: false, error: 'Alasan perubahan wajib diisi' }
  if (trimmed.length < REDEEM_REASON_MIN) {
    return {
      valid: false,
      error: `Alasan minimal ${REDEEM_REASON_MIN} karakter — ia tercatat di jejak audit bersama nilai lama dan baru`,
    }
  }
  if (trimmed.length > REDEEM_REASON_MAX) {
    return { valid: false, error: `Alasan maksimal ${REDEEM_REASON_MAX} karakter` }
  }
  return { valid: true, value: trimmed }
}

// ─── Galat yang bisa dibaca manusia ─────────────────────────────────────────

/**
 * Pesan per KODE galat yang kontraknya sebutkan namanya.
 *
 * Keduanya 409 dan keduanya berarti "keputusan ini tidak lagi bisa diambil dari
 * sini", tapi tindak lanjutnya berbeda — jadi pesannya juga berbeda.
 */
const CODE_MESSAGES: Record<string, string> = {
  ALREADY_APPROVED:
    'Pencairan ini sudah disetujui lebih dulu — transfernya mungkin sudah berangkat. Kalau ada yang salah, tuntaskan lewat antrean Pencairan Bermasalah, bukan dari sini.',
  INVALID_ORDER_STATE:
    'Order ini tidak lagi menunggu persetujuan — statusnya sudah berubah (sudah dibayar, kedaluwarsa, atau sudah mendarat di antrean Pencairan Bermasalah).',
}

/**
 * Ubah kegagalan permintaan menjadi satu kalimat yang bisa dibaca operator.
 *
 * Dipetakan per KODE lebih dulu, lalu per STATUS. Urutan itu penting: gerbang ini
 * dibangun dari kontrak sementara backend-nya (USDX-668) dikerjakan paralel, jadi
 * kode galat untuk 403 belum bisa dipastikan ejaannya. Bersandar pada STATUS untuk
 * kasus peran membuat AC "403 tampil sebagai pesan manusia, bukan error mentah"
 * tetap terpenuhi apa pun kode yang akhirnya dipilih server.
 */
export function redeemApprovalErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const byCode = CODE_MESSAGES[err.code]
    if (byCode) return byCode
    if (err.status === 403) {
      return 'Peran Anda tidak berwenang mengambil keputusan ini. Menyetujui, menolak, dan mengubah ambang hanya untuk Manager dan Admin.'
    }
    if (err.status === 404) {
      return 'Order ini sudah tidak ada di antrean. Muat ulang daftarnya.'
    }
    if (err.status === 400) {
      // Pesan server dipakai apa adanya: untuk 400 ia menyebut field yang salah,
      // dan menggantinya dengan kalimat generik menghapus satu-satunya petunjuk
      // yang bisa dipakai operator untuk membetulkan isiannya.
      return err.message
    }
    if (err.status >= 500) {
      return 'Server gagal memproses permintaan ini. Tidak ada yang berubah — coba lagi.'
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Permintaan gagal.'
}
