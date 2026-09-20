// Kontrak `/api/v1/payout-controls` — plafon dan rem uang KELUAR.
//
// DUA SISI, DUA UMUR:
//
//   BACA  `GET /`                       sudah ada di `backend@origin/dev`.
//   TULIS `POST /limits`                belum. Ia hidup di branch backend
//   RIWAYAT `GET /limits/history`       `wisnubarata111/be-tutup-lubang-jejak-dan-plafon`
//                                       dan BELUM merge.
//
// Layar ini memakai keduanya, jadi PR-nya TIDAK BOLEH MERGE sebelum PR backend
// itu naik. Sampai itu terjadi, kedua endpoint tulis menjawab 404 dan layar
// menanganinya dengan kalimat yang menyebut sebabnya — bukan dengan galat
// generik yang akan dilaporkan sebagai bug layar.

export interface PayoutControls {
  /** Rem aliran uang keluar. `false` = tidak ada rupiah yang berangkat. */
  payoutsEnabled: boolean
  /** Plafon satu payout. `null` = pakai bawaan server (env). */
  maxPerTxIdr: string | null
  /** Plafon akumulasi per hari WIB. `null` = pakai bawaan server. */
  maxDailyIdr: string | null
  /** Banyak order per satu putaran pengiriman. `null` = pakai bawaan server. */
  maxBatchPerTick: number | null
  updatedAt: string
  updatedBy: string | null
}

/** Snapshot ketiga plafon — bentuk yang dikirim dan yang tersimpan di riwayat. */
export interface PayoutLimits {
  maxPerTxIdr: string | null
  maxDailyIdr: string | null
  maxBatchPerTick: number | null
}

/**
 * Badan `POST /api/v1/payout-controls/limits`.
 *
 * SNAPSHOT UTUH, BUKAN TAMBAL SULAM: ketiga plafon WAJIB ada (masing-masing
 * boleh `null`). Field yang HILANG ditolak 422 — kalau field hilang berarti
 * "jangan diubah", satu kelalaian mengetik akan tampak identik dengan keputusan
 * sadar mengembalikan sebuah plafon ke bawaan server. Dan badan ini dibaca
 * ORANG KEDUA: yang ia setujui harus persis sama dengan yang akan berlaku.
 */
export interface UpdatePayoutLimitsBody extends PayoutLimits {
  reason: string
}

/** Satu versi perubahan plafon, append-only. */
export interface PayoutControlChange {
  id: string
  createdAt: string
  reason: string
  approvalRequestId: string | null
  proposerStaffId: string
  approverStaffId: string | null
  before: PayoutLimits
  after: PayoutLimits
  ipAddress: string | null
}

/**
 * Panjang minimum `reason`, dihitung SETELAH trim. Angka yang sama dengan
 * `PAYOUT_LIMITS_REASON_MIN_LENGTH` di DTO backend dan dengan CHECK
 * `payout_control_changes_reason_not_blank` (migrasi 0103). Ketiganya wajib
 * sama: yang longgar di satu lapisan berubah jadi galat di lapisan berikutnya,
 * pada titik yang paling mahal.
 */
export const PAYOUT_LIMITS_REASON_MIN = 10
export const PAYOUT_LIMITS_REASON_MAX = 500

/**
 * `updatedAt` yang dikirim server saat TIDAK ADA baris kontrol sama sekali:
 * `new Date(0).toISOString()`. Bukan stempel waktu sungguhan — merendernya
 * sebagai "1 Januari 1970" akan membuat operator mengira plafonnya pernah
 * disetel dan sudah sangat tua.
 */
export const NO_ROW_UPDATED_AT = '1970-01-01T00:00:00.000Z'

export function hasControlRow(controls: PayoutControls): boolean {
  return controls.updatedAt !== NO_ROW_UPDATED_AT
}
