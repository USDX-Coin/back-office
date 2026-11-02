/**
 * Aturan murni layar "Swap IDR→USD" + antrean "Swap Bermasalah" (D29,
 * `sot/bni-integration.md § 21.4–§ 21.6, § 21.9`, kontrak `sot/api/mint-swaps.yaml`).
 *
 *  1. SEMUA ENUM TERBUKA. Status, `issueCode`, hasil percobaan, jenis kejadian
 *     riwayat, dan sumbernya: nilai yang tidak dikenal dirender sebagai KODENYA
 *     (AC USDX-792), tidak ditebak artinya.
 *  2. TOMBOL HANYA DARI `allowedActions`. Server sudah menghitungnya untuk peran
 *     pemanggil; FE memotongnya lagi dengan peran (fail-closed) dan membuang aksi
 *     yang tidak dikenal. Tidak ada tombol mati — yang tidak sah tidak dirender.
 *  3. KODE GALAT BISA DI `code` ATAU `message`. `ConflictException("ALREADY_RESOLVED")`
 *     di backend menjadi `{ code: "CONFLICT", message: "ALREADY_RESOLVED" }`
 *     (`mint-swaps.errors.ts`) — pola yang sama dengan Pencairan Bermasalah.
 */
import { ApiError } from './apiFetch'
import { formatIdrExact } from './redeemApprovals'
import type { StatusConfig } from './status'
import type {
  MintSwapAction,
  MintSwapAttempt,
  MintSwapDetail,
  MintSwapStatus,
  MintSwapTimelineEvent,
  ResolveMintSwapBody,
} from './types'

// ─── Status swap (§ 21.5) ───────────────────────────────────────────────────

const pill = (label: string, className: string, dotClass: string): StatusConfig => ({
  label,
  variant: 'outline',
  className,
  dotClass,
})

const STATUS_PILLS: Record<MintSwapStatus, StatusConfig> = {
  QUEUED: pill('Menunggu dikirim', 'bg-muted text-muted-foreground', 'bg-muted-foreground'),
  IN_FLIGHT: pill('Sedang di bank', 'bg-primary/10 text-primary', 'bg-primary'),
  SUCCEEDED: pill('Berhasil ditukar', 'bg-success/10 text-success', 'bg-success'),
  NEEDS_ACTION: pill('Perlu tindakan', 'bg-gold-soft text-gold-foreground', 'bg-gold'),
  SETTLED_MANUAL: pill('Ditukar manual', 'bg-success/10 text-success', 'bg-success'),
  CLOSED: pill('Ditutup', 'bg-destructive/10 text-destructive', 'bg-destructive'),
}

/** Kalimat satu baris per status — dipakai kotak status modal. */
const STATUS_SENTENCES: Record<MintSwapStatus, string> = {
  QUEUED: 'Swap menunggu giliran dikirim ke BNI. Sistem mengirim dan mencoba ulang sendiri.',
  IN_FLIGHT: 'Perintah swap sudah dikirim ke BNI dan hasilnya sedang ditunggu. Sistem menanyakan statusnya sendiri.',
  SUCCEEDED: 'Rupiah sudah ditukar ke dolar. Order bisa diajukan untuk mint.',
  NEEDS_ACTION: 'Sistem tidak bisa menyelesaikan swap ini sendiri. Butuh keputusan Manager atau Admin.',
  SETTLED_MANUAL: 'Treasury sudah menukar di luar sistem dan orang kedua menyetujuinya. Order lanjut ke mint.',
  CLOSED: 'Swap ditutup tanpa ditukar. Order gagal dan rupiah dikembalikan ke nasabah secara manual oleh treasury.',
}

export const MINT_SWAP_STATUS_OPTIONS: { value: MintSwapStatus; label: string }[] = (
  Object.keys(STATUS_PILLS) as MintSwapStatus[]
).map((value) => ({ value, label: STATUS_PILLS[value].label }))

export function isMintSwapStatus(value: string): value is MintSwapStatus {
  return value in STATUS_PILLS
}

/** Badge status. Status tak dikenal tampil sebagai kodenya, tanpa warna yang mengarang arti. */
export function mintSwapStatusPill(status: string): StatusConfig {
  return STATUS_PILLS[status as MintSwapStatus] ?? pill(status, 'bg-muted text-muted-foreground', 'bg-muted-foreground')
}

export function mintSwapStatusSentence(status: string): string | null {
  return STATUS_SENTENCES[status as MintSwapStatus] ?? null
}

// ─── Penyebab NEEDS_ACTION (§ 21.4) ─────────────────────────────────────────

const ISSUE_LABELS: Record<string, string> = {
  BANK_REJECTED: 'BNI menolak swap ini. Mengulang dengan cara yang sama tidak akan berhasil.',
  RETRY_EXHAUSTED: 'Sudah 30 menit dan swap belum berhasil. Percobaan otomatis dihentikan.',
  RESULT_PENDING: 'Sudah 30 menit dan BNI belum memberi jawaban pasti. Sistem tetap menanyakan statusnya.',
  TRANSFER_DISABLED: 'Swap IDR→USD sedang dimatikan di server, jadi perintah tidak dikirim ke BNI.',
}

/** Kalimat untuk `issueCode`; kode tak dikenal dikembalikan APA ADANYA (AC). */
export function mintSwapIssueLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return ISSUE_LABELS[code] ?? code
}

// ─── Percobaan (§ 21.2 mint_swap_attempts) ──────────────────────────────────

const OUTCOME_LABELS: Record<string, string> = {
  PENDING: 'Belum ada jawaban final',
  SUCCEEDED: 'Berhasil',
  FAILED: 'Ditolak',
  UNKNOWN: 'Hasil belum pasti',
  NOT_SENT: 'Tidak terkirim ke bank',
}

export function attemptOutcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome
}

/** Percobaan terakhir (nomor terbesar) — dasar sah atau tidaknya aksi (§ 21.6). */
export function lastAttempt(attempts: readonly MintSwapAttempt[]): MintSwapAttempt | undefined {
  return [...attempts].sort((a, b) => a.attemptNo - b.attemptNo).at(-1)
}

// ─── Aksi ops (§ 21.6) ──────────────────────────────────────────────────────

const KNOWN_ACTIONS: readonly MintSwapAction[] = ['RETRY', 'SETTLED_MANUAL', 'CLOSED']

/** Label tombol — kata kerja, karena ia yang akan terjadi. */
export const MINT_SWAP_ACTION_LABELS: Record<MintSwapAction, string> = {
  RETRY: 'Coba lagi',
  SETTLED_MANUAL: 'Sudah ditukar manual',
  CLOSED: 'Tutup swap',
}

/** Label jejak keputusan — bentuk lampau. */
const REVIEW_LABELS: Record<MintSwapAction, string> = {
  RETRY: 'Dicoba lagi',
  SETTLED_MANUAL: 'Dinyatakan sudah ditukar manual',
  CLOSED: 'Ditutup tanpa ditukar',
}

export function mintSwapReviewLabel(action: string): string {
  return REVIEW_LABELS[action as MintSwapAction] ?? action
}

/**
 * Tombol yang dirender: `allowedActions` dari server, dipotong peran (STAFF /
 * DEVELOPER baca saja) dan dibuang yang tidak dikenal. Urutan tetap = urutan § 21.6.
 */
export function visibleMintSwapActions(
  allowed: readonly string[] | undefined,
  canResolve: boolean,
): MintSwapAction[] {
  if (!canResolve || !allowed) return []
  return KNOWN_ACTIONS.filter((a) => allowed.includes(a))
}

/**
 * Kenapa aksi ini tersedia SAAT INI — kalimat di atas tombol (§ 21.6 UX).
 * Dibaca dari percobaan terakhir, aturan yang sama dengan server.
 */
export function actionAvailabilityReason(action: MintSwapAction, detail: Pick<MintSwapDetail, 'attempts'>): string {
  const last = lastAttempt(detail.attempts)
  const lastText = last
    ? `percobaan terakhir (ke-${last.attemptNo}) ${attemptOutcomeLabel(last.outcome).toLowerCase()}`
    : 'belum ada percobaan yang dikirim'
  switch (action) {
    case 'RETRY':
      return `Coba lagi tersedia karena ${lastText}, jadi tidak ada transfer yang menggantung di bank.`
    case 'SETTLED_MANUAL':
      return last && last.outcome === 'UNKNOWN'
        ? 'Sudah ditukar manual tersedia karena BNI menandai percobaan terakhir untuk ditinjau manual.'
        : `Sudah ditukar manual tersedia karena ${lastText}. Pakai ini hanya kalau treasury sudah menukar di luar sistem.`
    case 'CLOSED':
      return `Tutup swap tersedia karena ${lastText}.`
  }
}

// ─── Form resolve ───────────────────────────────────────────────────────────

/** `ResolveMintSwap.reason` 10..500, dihitung SELAIN spasi (kontrak § resolve 400). */
export const MINT_SWAP_REASON_MIN = 10
export const MINT_SWAP_REASON_MAX = 500
/** `ResolveMintSwap.externalRef maxLength: 64`. */
export const MINT_SWAP_EXTERNAL_REF_MAX = 64
/** `creditedUsd pattern ^\d{1,12}\.\d{2}$`. */
const CREDITED_USD_RE = /^\d{1,12}\.\d{2}$/

export interface MintSwapResolveInput {
  action: MintSwapAction
  reason: string
  externalRef: string
  creditedUsd: string
}

export type MintSwapResolveErrors = Partial<Record<'reason' | 'externalRef' | 'creditedUsd', string>>

/**
 * Isian dolar → bentuk kontrak `"1000.50"`. Menerima `1000`, `1000.5`, `1000.50`
 * (titik desimal, tanpa pemisah ribuan). Selain itu `null` — tidak ditebak.
 */
export function normalizeCreditedUsd(raw: string): string | null {
  const v = raw.trim()
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(v)
  if (!m) return null
  const value = `${m[1]}.${(m[2] ?? '').padEnd(2, '0')}`
  return CREDITED_USD_RE.test(value) ? value : null
}

export function buildMintSwapResolveBody(
  input: MintSwapResolveInput,
): { valid: true; body: ResolveMintSwapBody } | { valid: false; errors: MintSwapResolveErrors } {
  const errors: MintSwapResolveErrors = {}
  const reason = input.reason.trim()
  if (reason.replace(/\s/g, '').length < MINT_SWAP_REASON_MIN) {
    errors.reason = `Alasan minimal ${MINT_SWAP_REASON_MIN} karakter selain spasi — ia masuk jejak audit yang tidak bisa diubah.`
  } else if (reason.length > MINT_SWAP_REASON_MAX) {
    errors.reason = `Alasan maksimal ${MINT_SWAP_REASON_MAX} karakter.`
  }

  if (input.action !== 'SETTLED_MANUAL') {
    if (errors.reason) return { valid: false, errors }
    return { valid: true, body: { action: input.action, reason } }
  }

  const externalRef = input.externalRef.trim()
  if (!externalRef) errors.externalRef = 'Nomor referensi BNI wajib diisi.'
  else if (externalRef.length > MINT_SWAP_EXTERNAL_REF_MAX) {
    errors.externalRef = `Nomor referensi maksimal ${MINT_SWAP_EXTERNAL_REF_MAX} karakter.`
  }
  const creditedUsd = normalizeCreditedUsd(input.creditedUsd)
  if (!input.creditedUsd.trim()) errors.creditedUsd = 'Dolar yang diterima wajib diisi.'
  else if (!creditedUsd) {
    errors.creditedUsd = 'Isi dolar dengan titik desimal, tanpa pemisah ribuan, maksimal 2 desimal (contoh 1000.50).'
  }
  if (errors.reason || errors.externalRef || errors.creditedUsd || !creditedUsd) return { valid: false, errors }
  return { valid: true, body: { action: 'SETTLED_MANUAL', reason, externalRef, creditedUsd } }
}

// ─── Angka ──────────────────────────────────────────────────────────────────

function splitSign(raw: string): { negative: boolean; abs: string } {
  const v = raw.trim()
  return v.startsWith('-') ? { negative: true, abs: v.slice(1) } : { negative: false, abs: v.replace(/^\+/, '') }
}

/** Dolar dengan sampai 6 desimal (`usd_difference numeric(20,6)`) → `$0,97` / `$0,000500`. */
function formatUsdPrecise(abs: string): string {
  if (!/^\d+(\.\d+)?$/.test(abs)) return `$${abs}`
  const [whole = '0', fraction = ''] = abs.split('.')
  const trimmed = fraction.replace(/0+$/, '').padEnd(2, '0')
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${trimmed}`
}

/**
 * Selisih dolar diterima vs USDX order, DALAM KATA (bukan hanya warna):
 * `"kurang $0,03"` / `"lebih $0,97"` / `"pas"`. Tak terbaca → nilai apa adanya.
 */
export function formatUsdDifference(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null
  const { negative, abs } = splitSign(raw)
  if (!/^\d+(\.\d+)?$/.test(abs)) return raw
  if (/^0+(\.0+)?$/.test(abs)) return 'pas'
  return `${negative ? 'kurang' : 'lebih'} ${formatUsdPrecise(abs)}`
}

/** Selisih bertanda negatif? Dipakai untuk memberi nada peringatan (teksnya tetap menyebut "kurang"). */
export function isUsdShortfall(raw: string | null | undefined): boolean {
  return Boolean(raw && splitSign(raw).negative && !/^0+(\.0+)?$/.test(splitSign(raw).abs))
}

export function formatIdrOrDash(raw: string | null | undefined): string {
  return raw == null || raw === '' ? '—' : formatIdrExact(raw)
}

/** Dolar 2 atau 6 desimal → `$1.000,97` (nol ujung dibuang, minimal 2 desimal). */
export function formatUsdOrDash(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '—'
  const { negative, abs } = splitSign(raw)
  return `${negative ? '-' : ''}${formatUsdPrecise(abs)}`
}

/**
 * Lama menunggu dari `waitingSeconds`: `"45 detik"`, `"12 menit"`, `"6 jam 5 menit"`, `"3 hari"`.
 * Jam dipakai sampai 48 jam (pola `formatQueueAge` Pencairan Bermasalah).
 */
export function formatWaiting(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.floor(seconds)
  if (s < 60) return `${s} detik`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return minutes % 60 ? `${hours} jam ${minutes % 60} menit` : `${hours} jam`
  return `${Math.floor(hours / 24)} hari`
}

// ─── Riwayat satu transaksi (§ 21.9) ────────────────────────────────────────

const TIMELINE_KIND_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order dibuat',
  VA_ISSUED: 'VA diterbitkan',
  PAID: 'Nasabah membayar',
  PG_FEE: 'Biaya PG kontrak',
  SWAP_QUEUED: 'Swap masuk antrean',
  SWAP_ATTEMPT_SENT: 'Percobaan swap dikirim',
  SWAP_ATTEMPT_FINAL: 'Hasil percobaan swap',
  IDR_DEBIT_RECONCILED: 'Debit rupiah terbukti di mutasi',
  USD_CREDIT_RECONCILED: 'Kredit dolar tercatat',
  OPS_DECISION: 'Keputusan ops',
  MINT_PROPOSED: 'Mint diajukan',
  MINT_APPROVED: 'Mint disetujui',
  MINT_EXECUTED: 'Mint dieksekusi',
  PG_SETTLED: 'Pencairan PG',
  PROFIT_FINAL: 'Untung final',
}

export function timelineKindLabel(kind: string): string {
  return TIMELINE_KIND_LABELS[kind] ?? kind
}

const SOURCE_LABELS: Record<string, string> = {
  mint_orders: 'Order mint',
  durianpay_notifications: 'Notifikasi Durianpay',
  mint_swaps: 'Antrean swap',
  mint_swap_attempts: 'Percobaan swap',
  bni_notifications: 'Notifikasi BNI',
  statement_entries: 'Salinan mutasi BNI',
  mint_swap_reviews: 'Keputusan ops',
  safe_transactions: 'Safe',
  pg_settlement_batches: 'Batch pencairan PG',
}

/** Sumber angka dalam kata; sumber tak dikenal dikembalikan apa adanya. */
export function timelineSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}

/**
 * Riwayat urut waktu (AC: "Timeline detail urut waktu"). Server sudah
 * mengurutkan; FE mengurutkan lagi secara STABIL — waktu sama ⇒ urutan server
 * (alur sebab-akibat) dipertahankan. Waktu tak terbaca ditaruh di akhir.
 */
export function sortTimeline(events: readonly MintSwapTimelineEvent[]): MintSwapTimelineEvent[] {
  const at = (e: MintSwapTimelineEvent) => {
    const t = Date.parse(e.at)
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
  }
  return events
    .map((e, i) => ({ e, i }))
    .sort((x, y) => at(x.e) - at(y.e) || x.i - y.i)
    .map(({ e }) => e)
}

// ─── Label status order / Safe di detail ────────────────────────────────────

const BATCH_STATUS_TEXT: Record<string, string> = {
  OPEN: 'Menunggu dana Durianpay masuk',
  MATCHED: 'Cocok dengan kredit di mutasi',
  MISMATCH: 'Tidak cocok — perlu dicek ops',
  MATCHED_MANUAL: 'Ditautkan manual oleh ops',
}

export function batchStatusText(status: string): string {
  return BATCH_STATUS_TEXT[status] ?? status
}

// ─── Galat ──────────────────────────────────────────────────────────────────

const NAMED_ERRORS: Record<string, string> = {
  ALREADY_RESOLVED: 'Swap ini sudah diselesaikan orang lain. Data sudah dimuat ulang — periksa keputusan yang sudah diambil.',
  ACTION_NOT_ALLOWED: 'Aksi ini tidak sah untuk keadaan swap sekarang (misalnya percobaan terakhir masih menunggu jawaban bank). Data sudah dimuat ulang.',
  APPROVAL_ALREADY_PENDING: 'Sudah ada usulan "Sudah ditukar manual" yang menunggu orang kedua. Data sudah dimuat ulang — buka usulannya di Persetujuan Orang Kedua.',
  EXTERNAL_REF_REQUIRED: 'Nomor referensi BNI wajib diisi.',
  CREDITED_USD_REQUIRED: 'Dolar yang diterima wajib diisi.',
  MINT_SWAP_NOT_FOUND: 'Swap ini tidak ditemukan. Muat ulang daftarnya.',
}

/** Kode yang berarti keadaan di server sudah berubah — layar wajib menarik ulang. */
const STALE_CODES = new Set(['ALREADY_RESOLVED', 'ACTION_NOT_ALLOWED', 'APPROVAL_ALREADY_PENDING', 'MINT_SWAP_NOT_FOUND'])

function namedCode(err: ApiError): string | null {
  if (NAMED_ERRORS[err.code]) return err.code
  if (NAMED_ERRORS[err.message]) return err.message
  return null
}

export function mintSwapErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const code = namedCode(err)
    if (code) return NAMED_ERRORS[code]!
    if (err.status === 403) return 'Peranmu tidak berwenang menyelesaikan swap bermasalah. Aksi ini hanya untuk Manager dan Admin.'
    if (err.status === 404) return NAMED_ERRORS.MINT_SWAP_NOT_FOUND!
    if (err.status >= 500) return 'Server gagal memproses permintaan ini. Tidak ada yang berubah — coba lagi.'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Permintaan gagal.'
}

export function isMintSwapStaleError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  if (err.status === 404) return true
  const code = namedCode(err)
  return code !== null && STALE_CODES.has(code)
}
