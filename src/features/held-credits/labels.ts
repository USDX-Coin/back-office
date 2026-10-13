import type { StatusConfig } from '@/lib/status'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { HeldCreditListItem, HeldCreditSource } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Menerjemahkan antrean "Mint Bermasalah" ke kalimat operator.
//
// Nilai `heldReason` adalah `text` di database, bukan enum — daftarnya tumbuh
// dari kode penangan notifikasi. Yang belum punya terjemahan dirender mentah;
// kode mesinnya TIDAK PERNAH dibuang, karena itu yang dikutip ke tim teknis.
// ─────────────────────────────────────────────────────────────────────────────

const HELD_REASON_LABELS: Record<string, string> = {
  NO_MATCHING_ORDER: 'Tidak ada order dengan nominal ini',
  AMBIGUOUS_MATCH: 'Lebih dari satu order menunggu nominal yang sama',
  LATE_PAYMENT: 'Uang masuk setelah ordernya kedaluwarsa',
  DUPLICATE_PAYMENT: 'Pembayaran ganda untuk order yang sama',
  UNKEYED: 'Notifikasi tanpa identitas — tidak bisa dicek ganda',
  INSTITUTION_MISMATCH: 'Notifikasi datang dari institusi lain',
  STALE_TIMESTAMP: 'Notifikasi di luar jendela kesegaran',
  AMOUNT_MISMATCH: 'Nominal yang masuk berbeda dari yang ditagihkan',
  ORDER_NOT_WAITING: 'Ordernya sedang tidak menunggu pembayaran',
  FAILURE_REASON_PRESENT: 'Penyedia pembayaran menyertakan sebab kegagalan',
}

export function heldReasonLabel(reason: string | null): string | null {
  if (!reason) return null
  return HELD_REASON_LABELS[reason] ?? null
}

const SOURCE_LABELS: Record<HeldCreditSource, string> = {
  BNI: 'Transfer ke rekening BNI',
  DURIANPAY_SNAP: 'Virtual account DurianPay',
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as HeldCreditSource] ?? source
}

export function sourcePill(source: string): StatusConfig {
  return {
    label: sourceLabel(source),
    variant: 'outline',
    className: 'bg-muted text-muted-foreground',
    dotClass: source === 'BNI' ? 'bg-primary' : 'bg-warning',
  }
}

/**
 * Nominal yang masuk. `receivedAmountIdr` null berarti yang masuk BUKAN rupiah
 * bulat — dan justru itu yang penting: nilai aslinya tetap dirender dari
 * `receivedAmountRaw`, tidak dibulatkan dan tidak disembunyikan di balik "—".
 */
export function receivedAmountLabel(credit: HeldCreditListItem): string {
  if (credit.receivedAmountIdr !== null) return formatIdrExact(credit.receivedAmountIdr)
  return `Rp ${credit.receivedAmountRaw} (bukan rupiah bulat)`
}

/** Selisih antara yang ditagihkan dan yang masuk, kalau keduanya terbaca. */
export function amountGapLabel(credit: HeldCreditListItem): string | null {
  const expected = credit.order?.expectedAmountIdr
  if (!expected || credit.receivedAmountIdr === null) return null
  const toCents = (raw: string): bigint | null => {
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim())
    if (!m) return null
    return BigInt(m[1]!) * 100n + BigInt((m[2] ?? '00').padEnd(2, '0'))
  }
  const a = toCents(expected)
  const b = toCents(credit.receivedAmountIdr)
  if (a === null || b === null) return null
  if (a === b) return null
  const diff = b - a
  const abs = diff < 0n ? -diff : diff
  const whole = abs / 100n
  const cents = abs % 100n
  const formatted = formatIdrExact(`${whole}.${String(cents).padStart(2, '0')}`)
  // "lebih"/"kurang" DI DEPAN nominalnya, bukan di belakang: di kolom tabel
  // yang sempit, ekor kalimatlah yang pertama terpotong — dan justru ekornya
  // yang membedakan kelebihan bayar dari kekurangan bayar.
  return diff > 0n ? `lebih ${formatted}` : `kurang ${formatted}`
}

/** Umur antrean — tiap satuannya uang nasabah yang belum jadi USDX. */
export function formatCreditAge(receivedAt: string, now: Date = new Date()): string {
  const then = Date.parse(receivedAt)
  if (Number.isNaN(then)) return '—'
  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60_000))
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} jam`
  return `${Math.floor(hours / 24)} hari`
}

/** Satu kalimat per kode galat bernama (`held-credits.errors.ts`). */
const NAMED_ERROR_MESSAGES: Record<string, string> = {
  HELD_CREDIT_NOT_FOUND:
    'Kredit ini tidak ditemukan. Kemungkinan tautannya sudah basi — muat ulang antreannya.',
  CREDIT_NOT_HELD:
    'Kredit ini sudah tidak tertahan — orang lain kemungkinan sudah menyelesaikannya. Muat ulang untuk melihat keputusan yang sudah diambil.',
  ORDER_ID_REQUIRED:
    'Kredit ini tidak cocok ke order mana pun, jadi menerimanya harus menyebutkan order yang dilunasi.',
  ORDER_MISMATCH:
    'Order yang kamu sebut berbeda dari order yang dicocokkan mesin untuk kredit ini.',
  ORDER_NOT_FOUND: 'Order dengan id itu tidak ada. Periksa ulang id-nya di Transaksi Nasabah.',
  ORDER_NOT_PAYABLE:
    'Order itu tidak dalam keadaan yang bisa dilunasi — mungkin sudah dibayar, dibatalkan, atau usulan mint-nya sudah berjalan.',
  CREDIT_NOT_RESOLVABLE:
    'Ledger pembayaran ini belum bisa mencatat putusan ops (sisa audit P0-2 di sisi DurianPay). Mencoba lagi dengan isian berbeda tidak akan menolong — teruskan ke tim teknis.',
}

export function heldCreditErrorMessage(code: string, fallback: string): string {
  return NAMED_ERROR_MESSAGES[code] ?? fallback
}

/** Kode yang berarti antreannya sudah berubah — cache wajib ditarik ulang. */
export function isStaleHeldCreditError(code: string): boolean {
  return code === 'CREDIT_NOT_HELD' || code === 'HELD_CREDIT_NOT_FOUND'
}
