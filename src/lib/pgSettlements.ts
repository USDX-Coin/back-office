/**
 * Aturan murni layar "Pencairan PG" + Settings → Payment Gateway (D29,
 * `sot/bni-integration.md § 21.8`, kontrak `sot/api/pg-settlements.yaml`).
 *
 * Batas validasi = batas KONTRAK, bukan yang lebih ketat: `reason` 10..500
 * (`minLength` setelah trim), `senderPattern` ≤ 200 dan tidak kosong (kolom
 * `NOT NULL`, dan pola kosong cocok dengan kredit APA PUN), `prefundingLowIdr`
 * rupiah 2 desimal atau `null` (= tanpa alert, rev-41).
 */
import { ApiError } from './apiFetch'
import { formatIdrExact } from './redeemApprovals'
import type { StatusConfig } from './status'
import type { PgSettlementMode, PgSettlementSettings, PgSettlementStatus, UpdatePgSettlementSettingsBody } from './types'

const pill = (label: string, className: string, dotClass: string): StatusConfig => ({
  label,
  variant: 'outline',
  className,
  dotClass,
})

const STATUS_PILLS: Record<PgSettlementStatus, StatusConfig> = {
  OPEN: pill('Menunggu dana', 'bg-muted text-muted-foreground', 'bg-muted-foreground'),
  MATCHED: pill('Cocok', 'bg-success/10 text-success', 'bg-success'),
  MISMATCH: pill('Tidak cocok', 'bg-destructive/10 text-destructive', 'bg-destructive'),
  MATCHED_MANUAL: pill('Ditautkan manual', 'bg-success/10 text-success', 'bg-success'),
}

export const PG_SETTLEMENT_STATUS_OPTIONS: { value: PgSettlementStatus; label: string }[] = (
  Object.keys(STATUS_PILLS) as PgSettlementStatus[]
).map((value) => ({ value, label: STATUS_PILLS[value].label }))

export function isPgSettlementStatus(value: string): value is PgSettlementStatus {
  return value in STATUS_PILLS
}

/** Badge status batch; status tak dikenal tampil sebagai kodenya. */
export function pgSettlementStatusPill(status: string): StatusConfig {
  return STATUS_PILLS[status as PgSettlementStatus] ?? pill(status, 'bg-muted text-muted-foreground', 'bg-muted-foreground')
}

const MODE_LABELS: Record<PgSettlementMode, string> = {
  NET: 'NET — dikirim sudah dipotong biaya',
  GROSS: 'GROSS — dikirim penuh, biaya ditagih terpisah',
}

const MODE_SHORT: Record<PgSettlementMode, string> = { NET: 'NET', GROSS: 'GROSS' }

export function pgModeLabel(mode: string): string {
  return MODE_LABELS[mode as PgSettlementMode] ?? mode
}

export function pgModeShort(mode: string): string {
  return MODE_SHORT[mode as PgSettlementMode] ?? mode
}

/** Total yang diharapkan menurut mode (§ 21.8) — kalimat untuk kartu dan dialog. */
export function pgModeExpectation(mode: string): string | null {
  if (mode === 'NET') return 'Total yang diharapkan = jumlah dana bersih order (sesudah biaya PG kontrak).'
  if (mode === 'GROSS') return 'Total yang diharapkan = jumlah tagihan penuh order (biaya PG ditagih terpisah).'
  return null
}

// ─── Selisih bertanda ───────────────────────────────────────────────────────

/**
 * `differenceIdr` = `creditedIdr − expectedIdr`. Ditulis DALAM KATA — "kurang
 * Rp 150.000,00" / "lebih …" / "pas" — supaya arahnya tidak hanya dibawa warna.
 */
export function formatIdrDifference(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null
  const v = raw.trim()
  const negative = v.startsWith('-')
  const abs = negative ? v.slice(1) : v.replace(/^\+/, '')
  if (!/^\d+(\.\d+)?$/.test(abs)) return raw
  if (/^0+(\.0+)?$/.test(abs)) return 'pas'
  return `${negative ? 'kurang' : 'lebih'} ${formatIdrExact(abs)}`
}

// ─── Validasi ───────────────────────────────────────────────────────────────

export const PG_REASON_MIN = 10
export const PG_REASON_MAX = 500
export const PG_SENDER_PATTERN_MAX = 200

/** `reason minLength: 10 maxLength: 500`, dihitung setelah trim; yang dikirim versi ter-trim. */
export function validatePgReason(raw: string): { value: string; error: string | null } {
  const value = raw.trim()
  if (value.length < PG_REASON_MIN) return { value, error: `Alasan minimal ${PG_REASON_MIN} karakter.` }
  if (value.length > PG_REASON_MAX) return { value, error: `Alasan maksimal ${PG_REASON_MAX} karakter.` }
  return { value, error: null }
}

/** Kosong = tanpa alert (`null`). Selain itu rupiah ≥ 0, maks 2 desimal, tanpa titik ribuan → `"N.00"`. */
export function validatePrefundingLow(raw: string): { value: string | null; error: string | null } {
  const v = raw.trim()
  if (v === '') return { value: null, error: null }
  const m = /^(\d{1,18})(?:\.(\d{1,2}))?$/.exec(v)
  if (!m) return { value: null, error: 'Isi rupiah tanpa titik ribuan, maksimal 2 desimal (contoh 200000000). Kosongkan untuk tanpa alert.' }
  return { value: `${m[1]}.${(m[2] ?? '').padEnd(2, '0')}`, error: null }
}

export function validateSenderPattern(raw: string): { value: string; error: string | null } {
  const value = raw.trim()
  if (!value) return { value, error: 'Pola pengirim wajib diisi — pola kosong akan cocok dengan kredit apa pun.' }
  if (value.length > PG_SENDER_PATTERN_MAX) return { value, error: `Pola pengirim maksimal ${PG_SENDER_PATTERN_MAX} karakter.` }
  return { value, error: null }
}

export interface PgSettingsFormInput {
  mode: string
  senderPattern: string
  prefundingLowIdr: string
  reason: string
}

export type PgSettingsFormErrors = Partial<Record<'mode' | 'senderPattern' | 'prefundingLowIdr' | 'reason', string>>

function sameAmount(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return Number(a) === Number(b)
}

/** Form → body PUT, atau galat per field. `unchanged` = tidak ada nilai yang berubah. */
export function buildPgSettingsBody(
  input: PgSettingsFormInput,
  current: PgSettlementSettings | undefined,
):
  | { valid: true; body: UpdatePgSettlementSettingsBody; unchanged: boolean }
  | { valid: false; errors: PgSettingsFormErrors; unchanged: boolean } {
  const errors: PgSettingsFormErrors = {}
  if (input.mode !== 'NET' && input.mode !== 'GROSS') errors.mode = 'Pilih mode NET atau GROSS.'
  const pattern = validateSenderPattern(input.senderPattern)
  if (pattern.error) errors.senderPattern = pattern.error
  const low = validatePrefundingLow(input.prefundingLowIdr)
  if (low.error) errors.prefundingLowIdr = low.error
  const reason = validatePgReason(input.reason)
  if (reason.error) errors.reason = reason.error

  const unchanged =
    !!current &&
    input.mode === current.mode &&
    pattern.value === current.senderPattern &&
    !low.error &&
    sameAmount(low.value, current.prefundingLowIdr)

  if (Object.keys(errors).length > 0) return { valid: false, errors, unchanged }
  return {
    valid: true,
    unchanged,
    body: {
      mode: input.mode as PgSettlementMode,
      senderPattern: pattern.value,
      prefundingLowIdr: low.value,
      reason: reason.value,
    },
  }
}

// ─── Saldo prefunding vs batas ──────────────────────────────────────────────

/** `true` / `false` bila keduanya terbaca; `null` bila salah satu tidak ada atau tak terbaca. */
export function isBelowPrefundingLow(balance: string | null | undefined, low: string | null | undefined): boolean | null {
  if (balance == null || low == null) return null
  const b = Number(balance)
  const l = Number(low)
  if (!Number.isFinite(b) || !Number.isFinite(l)) return null
  return b < l
}

// ─── Galat ──────────────────────────────────────────────────────────────────

const NAMED_ERRORS: Record<string, string> = {
  BATCH_NOT_MISMATCH: 'Batch ini sudah tidak berstatus "Tidak cocok" (mungkin sudah ditautkan orang lain). Data sudah dimuat ulang.',
  CREDIT_ALREADY_LINKED: 'Kredit ini sudah tertaut ke batch lain. Data sudah dimuat ulang — pilih kredit lain.',
}

const STALE_CODES = new Set(['BATCH_NOT_MISMATCH', 'CREDIT_ALREADY_LINKED'])

function namedCode(err: ApiError): string | null {
  if (NAMED_ERRORS[err.code]) return err.code
  if (NAMED_ERRORS[err.message]) return err.message
  return null
}

export function pgSettlementErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const code = namedCode(err)
    if (code) return NAMED_ERRORS[code]!
    if (err.status === 403) return 'Peranmu tidak berwenang mengubah ini. Hanya Manager dan Admin.'
    if (err.status === 404) return 'Data ini tidak ditemukan. Muat ulang daftarnya.'
    if (err.status >= 500) return 'Server gagal memproses permintaan ini. Tidak ada yang berubah — coba lagi.'
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Permintaan gagal.'
}

export function isPgSettlementStaleError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  if (err.status === 404) return true
  const code = namedCode(err)
  return code !== null && STALE_CODES.has(code)
}
