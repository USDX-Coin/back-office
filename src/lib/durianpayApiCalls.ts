/**
 * Aturan murni layar "Log Panggilan DurianPay".
 *
 * SUMBERNYA KODE BACKEND, BUKAN SOT. `sot/` belum memuat kontrak untuk
 * `/api/v1/durianpay-api-calls`; seluruh berkas ini ditranskripsi dari branch
 * backend `wisnubarata111/be-catat-log-panggilan-durianpay` (modul
 * `durianpay-api-calls/` + `durianpay/durianpay-api-call-log.service.ts` +
 * `durianpay/durianpay-api-call-redact.ts`). Kalau kontraknya kelak masuk SOT,
 * SOT yang menang dan berkas ini menyesuaikan.
 *
 * Empat hal di sini ada karena PEMBACANYA OPERATOR, bukan engineer:
 *
 *  1. PATH → KALIMAT. `/v1.0/transfer-va/create-va` tidak memberi tahu siapa pun
 *     apa yang barusan terjadi. Petanya disalin dari konstanta path backend
 *     (`DURIANPAY_SNAP_TOKEN_PATH`, `CREATE_VA_PATH`, `DURIANPAY_INQUIRY_VA_PATH`,
 *     `DURIANPAY_SNAP_*_PATH`, dan ketiga path Legacy di
 *     `durianpay-disbursement-client.service.ts`). Path yang TIDAK ada di peta
 *     dikembalikan `null` — pemanggil merender pathnya apa adanya dan tidak
 *     menebak artinya (preseden `payoutIssueCodeLabel`).
 *
 *  2. `SUCCESS` BUKAN "BERHASIL". Doc enum backend menyatakannya sendiri: SUCCESS
 *     berarti transportnya sampai dan dijawab, BUKAN bisnisnya berhasil — amplop
 *     SNAP bisa menolak di dalam HTTP 200. Kelas kejadian itu justru yang paling
 *     mudah luput karena angka statusnya hijau, dan `summarize()` di backend
 *     menandainya dengan mengisi `errorSummary` walau outcome-nya SUCCESS. Layar
 *     ini membaca tanda itu dan memberi verdict yang berbeda, bukan hijau.
 *
 *  3. `responseCode` TIDAK DITERJEMAHKAN PER KASUS. Yang dikatakan hanya apa yang
 *     bisa dibuktikan dari kode backend: tiga digit pertama adalah status yang
 *     DIKLAIM amplop, dan pembagian 2xx/4xx/5xx-nya persis `classifyOutcome`.
 *     Arti dua digit kasusnya tidak ditebak — "ke mana" sudah dijawab `path`.
 *
 *  4. BADAN PESAN BISA TERPOTONG, DAN ITU HARUS KELIHATAN. Backend memotong di
 *     16 KiB dan mengganti badannya dengan `{ _truncated, _bytes, _head }`;
 *     respons non-JSON disimpan sebagai `{ _raw }`. Merender keduanya seperti
 *     JSON biasa akan menampilkan potongan sebagai kalau itu seluruh isinya.
 */
import { ApiError } from './apiFetch'
import type { StatusConfig } from './status'
import type { DurianpayApiCallOutcome, DurianpayApiFlavor } from './types'

// ─── Saringan yang BENAR-BENAR ada di kontrak ───────────────────────────────
//
// `ListDurianpayApiCallsDto` menerima TUJUH saringan dan tidak satu pun di
// antaranya mencari teks di badan pesan. `path` adalah AWALAN (backend memakai
// `LIKE 'prefix%'` supaya index btree terpakai), bukan pencarian bebas — layar
// ini harus mengatakan itu, karena kotak yang terlihat seperti "cari" lalu tidak
// menemukan apa-apa membuat orang menyimpulkan datanya tidak ada.

/** `@MaxLength(200)` pada `path` di DTO. */
export const DURIANPAY_PATH_FILTER_MAX = 200
/** `@MaxLength(200)` pada `referenceNo` di DTO. */
export const DURIANPAY_REFERENCE_FILTER_MAX = 200
/** `@MaxLength(50)` pada `responseCode` di DTO. */
export const DURIANPAY_RESPONSE_CODE_FILTER_MAX = 50

const OUTCOMES: readonly DurianpayApiCallOutcome[] = ['SUCCESS', 'REJECTED', 'UNAVAILABLE']
const FLAVORS: readonly DurianpayApiFlavor[] = ['SNAP', 'LEGACY']

export function isDurianpayOutcome(value: string): value is DurianpayApiCallOutcome {
  return (OUTCOMES as readonly string[]).includes(value)
}

export function isDurianpayFlavor(value: string): value is DurianpayApiFlavor {
  return (FLAVORS as readonly string[]).includes(value)
}

/** Nilai mentah tiap saringan, apa adanya dari URL. */
export interface DurianpayApiCallFilterValues {
  from: string
  to: string
  outcome: string
  apiFlavor: string
  path: string
  referenceNo: string
  httpStatus: string
  responseCode: string
}

/** Saringan yang sudah lolos aturan kontrak dan boleh dikirim. */
export interface DurianpayApiCallQuery {
  page: number
  take: number
  from?: string
  to?: string
  outcome?: DurianpayApiCallOutcome
  apiFlavor?: DurianpayApiFlavor
  path?: string
  referenceNo?: string
  httpStatus?: number
  responseCode?: string
}

export const EMPTY_DURIANPAY_FILTER_VALUES: DurianpayApiCallFilterValues = {
  from: '',
  to: '',
  outcome: '',
  apiFlavor: '',
  path: '',
  referenceNo: '',
  httpStatus: '',
  responseCode: '',
}

/**
 * Tanggal kalender (`YYYY-MM-DD` dari isian tanggal) → instan ISO-8601 berpenanda
 * zona **+07:00**.
 *
 * Tanpa penanda zona, `2026-09-19` dibaca server sebagai tengah malam UTC, yaitu
 * pukul 07:00 WIB — tujuh jam panggilan pagi hilang dari hasil tanpa ada yang
 * memberi tahu. Seluruh repo ini menampilkan waktu dalam WIB, jadi tanggal yang
 * dipilih operator juga hari WIB. Bentuk yang bukan tanggal dikembalikan
 * `null` dan saringannya tidak dikirim, bukan ditebak.
 */
// Aturannya pindah ke `lib/wibRange.ts` ketika Jejak Audit mendapat saringan
// rentang waktu dengan bentuk DTO yang SAMA. Di-re-export dari sini supaya
// pemanggil lama tidak berubah — dan supaya kedua layar tidak punya dua salinan
// aturan yang bisa bergeser sendiri-sendiri.
export { wibDayStartIso, wibDayEndIso } from './wibRange'
// Re-export saja tidak membawa keduanya ke lingkup berkas ini; `toDurianpayApiCallQuery`
// di bawah memakainya langsung.
import { wibDayEndIso, wibDayStartIso } from './wibRange'

/**
 * Teks saringan yang boleh dikirim: sudah di-trim, kosong dan yang MELEBIHI batas
 * kontrak dibuang. Nilai kepanjangan dibuang alih-alih dipotong: memotongnya akan
 * menjawab pertanyaan yang tidak pernah ditanyakan operator, dan mengirimnya utuh
 * hanya menghasilkan 400 yang membuat tabel terlihat rusak.
 */
function textFilter(value: string, max: number): string | undefined {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return undefined
  return trimmed
}

/** `@IsInt() @Min(100) @Max(599)` di DTO. Bentuk lain tidak dikirim. */
function httpStatusFilter(value: string): number | undefined {
  const trimmed = value.trim()
  if (!/^\d{3}$/.test(trimmed)) return undefined
  const parsed = Number(trimmed)
  return parsed >= 100 && parsed <= 599 ? parsed : undefined
}

/**
 * Nilai URL → query kontrak. Nilai yang tidak dikenal kontrak DIBUANG, tidak
 * dikirim: sebuah tautan basi (atau URL yang diketik tangan) tidak boleh membuat
 * layarnya terlihat gagal dimuat karena server menjawab 400.
 */
export function toDurianpayApiCallQuery(
  values: DurianpayApiCallFilterValues,
  page: number,
  take: number,
): DurianpayApiCallQuery {
  const outcome = values.outcome.trim()
  const apiFlavor = values.apiFlavor.trim()
  return {
    page,
    take,
    from: wibDayStartIso(values.from.trim()) ?? undefined,
    to: wibDayEndIso(values.to.trim()) ?? undefined,
    outcome: isDurianpayOutcome(outcome) ? outcome : undefined,
    apiFlavor: isDurianpayFlavor(apiFlavor) ? apiFlavor : undefined,
    path: textFilter(values.path, DURIANPAY_PATH_FILTER_MAX),
    referenceNo: textFilter(values.referenceNo, DURIANPAY_REFERENCE_FILTER_MAX),
    httpStatus: httpStatusFilter(values.httpStatus),
    responseCode: textFilter(values.responseCode, DURIANPAY_RESPONSE_CODE_FILTER_MAX),
  }
}

/** Query string `GET /api/v1/durianpay-api-calls` — hanya parameter yang ada di DTO. */
export function buildDurianpayApiCallQueryString(query: DurianpayApiCallQuery): string {
  const sp = new URLSearchParams()
  sp.set('page', String(query.page))
  sp.set('take', String(query.take))
  if (query.from) sp.set('from', query.from)
  if (query.to) sp.set('to', query.to)
  if (query.outcome) sp.set('outcome', query.outcome)
  if (query.apiFlavor) sp.set('apiFlavor', query.apiFlavor)
  if (query.path) sp.set('path', query.path)
  if (query.referenceNo) sp.set('referenceNo', query.referenceNo)
  if (query.httpStatus !== undefined) sp.set('httpStatus', String(query.httpStatus))
  if (query.responseCode) sp.set('responseCode', query.responseCode)
  return sp.toString()
}

/** `true` kalau ada satu saringan pun yang benar-benar terkirim ke server. */
export function hasDurianpayFilter(query: DurianpayApiCallQuery): boolean {
  return Boolean(
    query.from ||
      query.to ||
      query.outcome ||
      query.apiFlavor ||
      query.path ||
      query.referenceNo ||
      query.httpStatus !== undefined ||
      query.responseCode,
  )
}

// ─── Panggilan mana ini ─────────────────────────────────────────────────────

/**
 * Path endpoint → kalimat yang menjawab "apa yang kita minta ke DurianPay".
 *
 * Kuncinya DISALIN dari konstanta path di backend, bukan dikarang:
 *   `/v1.0/access-token/b2b`         `durianpay-snap-client.service.ts`
 *   `/v1.0/transfer-va/create-va`    `durianpay-snap-payment.provider.ts`
 *   `/v1.0/transfer-va/inquiry-va`   `durianpay-inquiry-va.ts`
 *   `/v1.0/account-inquiry-external` `durianpay-snap-disbursement.types.ts`
 *   `/v1.0/transfer-interbank`       idem
 *   `/v1.0/transfer/status`          idem
 *   `/v1.0/balance-inquiry`          idem
 *   `/v1/disbursements/*`            `durianpay-disbursement-client.service.ts`
 */
const CALL_LABELS: Record<string, string> = {
  '/v1.0/access-token/b2b': 'Ambil token akses',
  '/v1.0/transfer-va/create-va': 'Buat nomor VA untuk nasabah',
  '/v1.0/transfer-va/inquiry-va': 'Cek status tagihan VA',
  '/v1.0/account-inquiry-external': 'Cek nama pemilik rekening tujuan',
  '/v1.0/transfer-interbank': 'Kirim rupiah ke rekening nasabah',
  '/v1.0/transfer/status': 'Cek status kiriman rupiah',
  '/v1.0/balance-inquiry': 'Cek saldo kita di DurianPay',
  // Jalur Legacy — sandbox/dev saja; payout production wajib SNAP.
  '/v1/disbursements/validate': 'Cek rekening tujuan (jalur lama)',
  '/v1/disbursements/submit': 'Kirim rupiah (jalur lama)',
}

/** `/v1/disbursements/{id}/items` — id-nya berubah tiap batch, jadi dicocokkan berpola. */
const LEGACY_ITEMS_PATH = /^\/v1\/disbursements\/[^/]+\/items$/

/** Buang query string: path Legacy `submit` membawa `?force_disburse=true` apa adanya. */
function endpointOf(path: string): string {
  const mark = path.indexOf('?')
  return mark === -1 ? path : path.slice(0, mark)
}

/**
 * Kalimat untuk sebuah path, atau `null` kalau pathnya belum dikenal. `null`
 * BUKAN kegagalan: pemanggil merender pathnya sendiri, yang tetap menjawab
 * pertanyaannya bagi yang paham — sedangkan arti karangan tidak bisa dikoreksi
 * oleh siapa pun yang membacanya.
 */
export function durianpayCallLabel(path: string): string | null {
  const endpoint = endpointOf(path)
  const exact = CALL_LABELS[endpoint]
  if (exact) return exact
  if (LEGACY_ITEMS_PATH.test(endpoint)) return 'Cek status pencairan (jalur lama)'
  return null
}

// ─── Berhasil atau tidak ────────────────────────────────────────────────────

const OUTCOME_PILL_CLEAN: StatusConfig = {
  label: 'Berhasil',
  variant: 'default',
  className: 'bg-success/10 text-success',
  dotClass: 'bg-success',
}

const OUTCOME_PILL_REFUSED_INSIDE: StatusConfig = {
  label: 'Ditolak di jawaban',
  variant: 'destructive',
  className: 'bg-destructive/10 text-destructive',
  dotClass: 'bg-destructive',
}

const OUTCOME_PILL_REJECTED: StatusConfig = {
  label: 'Ditolak',
  variant: 'destructive',
  className: 'bg-destructive/10 text-destructive',
  dotClass: 'bg-destructive',
}

const OUTCOME_PILL_UNAVAILABLE: StatusConfig = {
  label: 'Tidak jelas',
  variant: 'outline',
  className: 'bg-warning/10 text-warning',
  dotClass: 'bg-warning',
}

export interface DurianpayOutcomeView {
  pill: StatusConfig
  /** Satu kalimat: apa artinya bagi orang yang harus menindaklanjutinya. */
  meaning: string
}

/**
 * Vonis yang dibaca operator — `outcome` DITAMBAH tanda dari `errorSummary`.
 *
 * Empat keadaan, bukan tiga. `SUCCESS` dengan `errorSummary` terisi hanya lahir
 * dari satu cabang `summarize()` di backend: HTTP 2xx dengan `responseCode` SNAP
 * yang tidak berawalan `2` — amplop menolak DI DALAM status hijau. Menampilkan
 * baris itu sebagai "Berhasil" menyembunyikan justru kegagalan yang paling sulit
 * ditemukan sendiri.
 */
export function durianpayOutcomeView(
  outcome: string,
  errorSummary: string | null,
): DurianpayOutcomeView {
  if (outcome === 'SUCCESS') {
    if (errorSummary) {
      return {
        pill: OUTCOME_PILL_REFUSED_INSIDE,
        meaning:
          'Status HTTP-nya hijau, tapi DurianPay menolak di dalam badan jawabannya. Perlakukan sebagai gagal.',
      }
    }
    return {
      pill: OUTCOME_PILL_CLEAN,
      meaning: 'Permintaan sampai dan dijawab tanpa keluhan.',
    }
  }
  if (outcome === 'REJECTED') {
    return {
      pill: OUTCOME_PILL_REJECTED,
      meaning: 'Permintaan sampai lalu ditolak. Operasinya TIDAK terjadi.',
    }
  }
  if (outcome === 'UNAVAILABLE') {
    return {
      pill: OUTCOME_PILL_UNAVAILABLE,
      meaning:
        'Tidak ada jawaban yang bisa dipegang — error 5xx, timeout, atau jaringan putus. Operasinya mungkin terjadi, mungkin tidak; inilah baris yang harus dicek ke DurianPay.',
    }
  }
  return {
    pill: {
      label: outcome,
      variant: 'outline',
      className: 'bg-muted text-muted-foreground',
      dotClass: 'bg-muted-foreground',
    },
    meaning: 'Vonis ini belum dikenal layar ini — baca badan jawabannya di Detail teknis.',
  }
}

/**
 * Keterangan manusia untuk `responseCode`, TANPA menghilangkan kodenya.
 *
 * Bentuk kode SNAP: 3 digit status + 2 digit layanan + 2 digit kasus. Bentuk itu
 * terbaca langsung di repo backend — create-va menjawab `2002700` dan inquiry-va
 * `2003000` untuk keadaan yang sama, hanya dua digit tengahnya berbeda. Yang
 * dikatakan di sini cuma pembagian tiga digit pertamanya, dan artinya disalin
 * dari doc `classifyOutcome`: 2xx sampai & dijawab, 4xx ditolak (operasinya tidak
 * terjadi), 5xx gagal diproses (hasilnya tidak pasti).
 *
 * Bentuk lain — termasuk `error_code` Legacy yang berupa kata (`invalid_bank_account`)
 * — dikembalikan `null`: ia sudah terbaca sendiri, dan menerjemahkannya berarti
 * menebak.
 */
export function describeResponseCode(code: string | null): string | null {
  if (!code || !/^\d{7}$/.test(code)) return null
  if (code.startsWith('2')) return 'DurianPay menerima permintaan ini'
  if (code.startsWith('4')) return 'DurianPay menolak permintaan ini — operasinya tidak terjadi'
  if (code.startsWith('5')) return 'DurianPay gagal memprosesnya — hasilnya tidak bisa dipastikan'
  return null
}

// ─── Angka yang dibaca sekilas ──────────────────────────────────────────────

/**
 * `durationMs` → lama panggilan. Di bawah satu detik tetap milidetik (beda 80 ms
 * dan 900 ms nyata bagi yang mengejar timeout); satu detik ke atas jadi detik
 * dengan satu desimal, ejaan Indonesia.
 */
export function formatCallDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1).replace('.', ',')} dtk`
}

/** Ukuran badan asli sebelum dipotong. */
export function formatBodyBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} byte`
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} KiB`
}

// ─── Badan pesan ────────────────────────────────────────────────────────────

/** Penanda redaksi yang dipasang `durianpay-api-call-redact.ts` sebelum insert. */
export const REDACTED_SECRET_MARK = '[REDACTED:SECRET]'
export const REDACTED_PII_MARK = '[REDACTED:PII]'

export type DurianpayBodyView =
  /** Kolomnya `null`: panggilan tanpa badan, atau respons yang tidak pernah datang. */
  | { kind: 'none' }
  /** JSON utuh, sudah diredaksi. */
  | { kind: 'json'; text: string }
  /** Respons yang BUKAN JSON (halaman HTML dari reverse proxy, dsb.) — `{ _raw }`. */
  | { kind: 'raw'; text: string }
  /** Lebih dari 16 KiB: yang tersimpan hanya kepalanya — `{ _truncated, _bytes, _head }`. */
  | { kind: 'truncated'; text: string; bytes: number | null }

/**
 * Badan tersimpan → bentuk yang boleh dirender.
 *
 * Urutannya penting: `_truncated` diperiksa DULUAN. Badan yang dipotong bukan
 * objek JSON lagi melainkan pembungkus berisi potongan teks, dan merendernya
 * sebagai JSON biasa akan menampilkan potongan itu seolah seluruh isinya.
 */
export function durianpayBodyView(body: Record<string, unknown> | null): DurianpayBodyView {
  if (!body) return { kind: 'none' }
  if (body._truncated === true) {
    const head = typeof body._head === 'string' ? body._head : ''
    return {
      kind: 'truncated',
      text: head,
      bytes: typeof body._bytes === 'number' ? body._bytes : null,
    }
  }
  if (typeof body._raw === 'string') return { kind: 'raw', text: body._raw }
  return { kind: 'json', text: JSON.stringify(body, null, 2) }
}

/** `true` kalau ada nilai yang dibuang penyaring — dipakai memunculkan keterangannya. */
export function hasRedactedValue(text: string): boolean {
  return text.includes(REDACTED_SECRET_MARK) || text.includes(REDACTED_PII_MARK)
}

// ─── Galat yang bisa dibaca manusia ─────────────────────────────────────────

export function durianpayApiCallErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return 'Peran Anda tidak berwenang membaca Log Panggilan DurianPay. Layar ini untuk Manager, Admin, dan Developer.'
    }
    if (err.status === 404) {
      return 'Panggilan ini tidak ada lagi. Jejaknya mungkin sudah dibersihkan penyapu retensi, atau tautannya salah.'
    }
    if (err.status >= 500) {
      return 'Server gagal membaca jejak ini. Tidak ada yang berubah — coba lagi.'
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Permintaan gagal.'
}
