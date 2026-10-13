import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PayoutLimits } from './types'

/**
 * Satu plafon rupiah. `null` BUKAN "kosong" — ia berarti "pakai bawaan server",
 * dan kalimatnya harus mengatakan itu. Merendernya sebagai "—" membuat operator
 * mengira tidak ada batas sama sekali, yang justru kebalikan dari kenyataannya.
 */
export function limitLabel(value: string | null): string {
  if (value === null) return 'Bawaan server'
  return formatIdrExact(value)
}

export function batchLabel(value: number | null): string {
  if (value === null) return 'Bawaan server'
  return `${value} order per putaran`
}

/** Baris "sebelum → sesudah" untuk riwayat dan pratinjau usulan. */
export interface LimitDiffLine {
  label: string
  before: string
  after: string
  changed: boolean
}

export function diffLimits(before: PayoutLimits, after: PayoutLimits): LimitDiffLine[] {
  return [
    {
      label: 'Plafon per transaksi',
      before: limitLabel(before.maxPerTxIdr),
      after: limitLabel(after.maxPerTxIdr),
      changed: before.maxPerTxIdr !== after.maxPerTxIdr,
    },
    {
      label: 'Plafon per hari (WIB)',
      before: limitLabel(before.maxDailyIdr),
      after: limitLabel(after.maxDailyIdr),
      changed: before.maxDailyIdr !== after.maxDailyIdr,
    },
    {
      label: 'Order per putaran',
      before: batchLabel(before.maxBatchPerTick),
      after: batchLabel(after.maxBatchPerTick),
      changed: before.maxBatchPerTick !== after.maxBatchPerTick,
    },
  ]
}

/**
 * Galat yang punya arti khusus di layar ini. `404` disebut apa adanya karena ia
 * BUKAN kerusakan layar: sisi tulis plafon belum ada di setiap server. Kalimat
 * generik "Not Found" di sini berakhir sebagai laporan bug yang salah alamat.
 */
export function payoutControlsErrorMessage(status: number, code: string, fallback: string): string {
  if (status === 404) {
    return 'Server ini belum menyajikan endpoint plafon pencairan. Sisi tulis dan riwayatnya baru ada setelah perubahan backend yang menyertainya naik — sampai saat itu plafon hanya bisa dibaca.'
  }
  if (status === 403) {
    return 'Mengubah plafon dan membaca riwayatnya hanya untuk Manager dan Admin.'
  }
  if (code === 'PAYOUT_LIMITS_PAYLOAD_INVALID') {
    return 'Usulan plafon tidak bisa dibaca server saat dijalankan. Jangan mengulang — teruskan ke tim teknis dengan id usulannya.'
  }
  return fallback
}
