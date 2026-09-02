import { getAddress, isAddress } from 'viem'
import type {
  AmountCurrency,
  CustomerRole,
  CustomerType,
  LedgerErrorCode,
  Network,
  RateMode,
  RequestChain,
  StaffRole,
  OncallChannel,
  OncallIncidentCategory,
} from './types'
import { LEDGER_ENTRY_TYPES_SELECTABLE, LEDGER_SUPPORTED_CURRENCY } from './types'
import { isFutureWibDate, parseAmountToCents, wibToday } from './transparency'

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9]{10,15}$/
const MAX_NAME_LEN = 100

// USDX-47 + sot/api/users.yaml § CreateUser/UpdateUser. Phase-1 user constraints
// are larger than the legacy customer/staff cap so they live in their own
// constants — staff/customer keep MAX_NAME_LEN=100 (their SoT is silent on max).
const MAX_USER_NAME_LEN = 255
const MAX_USER_NOTES_LEN = 2000
const MAX_USER_WALLETS = 50

function validateEmail(email: string, errors: Record<string, string>) {
  if (!email.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Invalid email format'
  }
}

function validateName(
  name: string,
  field: 'firstName' | 'lastName' | 'name',
  label: string,
  errors: Record<string, string>
) {
  if (!name.trim()) {
    errors[field] = `${label} is required`
  } else if (name.length > MAX_NAME_LEN) {
    errors[field] = `${label} must be under ${MAX_NAME_LEN} characters`
  }
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return 'Phone is required'
  if (!PHONE_RE.test(phone.replace(/[\s()-]/g, ''))) return 'Invalid phone format'
  return null
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function validateWalletAddress(
  address: string,
  network: Network
): string | null {
  if (!address.trim()) return 'Destination wallet is required'
  if (network === 'solana') {
    return SOLANA_BASE58_RE.test(address) ? null : 'Invalid Solana address'
  }
  return EVM_ADDRESS_RE.test(address) ? null : 'Invalid wallet address'
}

export function validateLoginForm(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {}
  validateEmail(email, errors)
  if (!password) errors.password = 'Password is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateCustomerForm(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  type: CustomerType | ''
  organization?: string
  role: CustomerRole | ''
}): ValidationResult {
  const errors: Record<string, string> = {}
  validateName(input.firstName, 'firstName', 'First name', errors)
  validateName(input.lastName, 'lastName', 'Last name', errors)
  validateEmail(input.email, errors)
  const phoneErr = validatePhone(input.phone)
  if (phoneErr) errors.phone = phoneErr
  if (!input.type) errors.type = 'Type is required'
  if (input.type === 'organization' && !(input.organization ?? '').trim()) {
    errors.organization = 'Organization is required'
  }
  if (!input.role) errors.role = 'Role is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateOtcMintForm(input: {
  customerId: string
  network: Network | ''
  amount: number | ''
  destinationAddress: string
  notes?: string
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.customerId) errors.customerId = 'Customer is required'
  if (!input.network) errors.network = 'Network is required'
  if (input.amount === '' || Number(input.amount) <= 0) errors.amount = 'Amount must be greater than 0'
  if (input.network) {
    const walletErr = validateWalletAddress(input.destinationAddress, input.network as Network)
    if (walletErr) errors.destinationAddress = walletErr
  } else if (!input.destinationAddress.trim()) {
    errors.destinationAddress = 'Destination wallet is required'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

// Rate update form validators
//
// SoT (sot/phase-1.md § Rate Configuration, openapi.yaml § UpdateRateConfig)
// defines required-when rules but no min/max. The bounds below are defensive
// defaults — see docs/notes/usdx-20-decisions.md for why we picked these
// numbers and how to revisit if the backend disagrees.

const DECIMAL_RE = /^\d+(\.\d{1,4})?$/
const SPREAD_RE = /^\d+(\.\d{1,2})?$/

const RATE_MIN_EXCLUSIVE = 0
const RATE_MAX_EXCLUSIVE = 100_000 // 6× current ~16k IDR/USD; blocks runaway typos
const SPREAD_MIN_INCLUSIVE = 0
const SPREAD_MAX_INCLUSIVE = 10 // 10% is already an extreme forex spread

const RATE_SOFT_LOW = 5_000
const RATE_SOFT_HIGH = 50_000

export function validateManualRate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return 'Manual rate is required'
  if (!DECIMAL_RE.test(trimmed)) return 'Rate must be a number (up to 4 decimals)'
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= RATE_MIN_EXCLUSIVE) return 'Rate must be greater than 0'
  if (n >= RATE_MAX_EXCLUSIVE) return `Rate must be less than ${RATE_MAX_EXCLUSIVE.toLocaleString()}`
  return null
}

export function validateSpreadPct(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null // optional in SoT
  if (!SPREAD_RE.test(trimmed)) return 'Spread must be a number (up to 2 decimals)'
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < SPREAD_MIN_INCLUSIVE) return 'Spread cannot be negative'
  if (n > SPREAD_MAX_INCLUSIVE) return `Spread must be at most ${SPREAD_MAX_INCLUSIVE}%`
  return null
}

// Soft warning bound — non-blocking; nudges users who likely typoed an extra
// or missing zero. Validation handles hard-impossible values; this catches
// the "syntactically valid but probably-wrong" case.
export function isManualRateUnusual(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed || !DECIMAL_RE.test(trimmed)) return false
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return false
  return n < RATE_SOFT_LOW || n > RATE_SOFT_HIGH
}

// USDX-207: spread directional — validate spread beli & jual independently
// (sot/api/rate.yaml § UpdateRateConfig). Same bounds as the old single spread.
export function validateRateUpdateForm(input: {
  mode: RateMode | ''
  manualRate: string
  spreadBuyPct: string
  spreadSellPct: string
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.mode) {
    errors.mode = 'Mode is required'
  }
  if (input.mode === 'MANUAL') {
    const err = validateManualRate(input.manualRate)
    if (err) errors.manualRate = err
  }
  // DYNAMIC: manualRate intentionally not validated — UI disables the field
  // and the payload omits it.
  const buyErr = validateSpreadPct(input.spreadBuyPct)
  if (buyErr) errors.spreadBuyPct = buyErr
  const sellErr = validateSpreadPct(input.spreadSellPct)
  if (sellErr) errors.spreadSellPct = sellErr
  return { valid: Object.keys(errors).length === 0, errors }
}

// USDX-207 + USDX-245: fee config form (sot/api/fee.yaml § UpdateFeeConfig).
// Full 5-field snapshot, all required. Percentages (mint / QRIS / redeem fee)
// reuse the spread bound; flat IDR amounts (PG VA / disbursement) reuse the
// flat-fee bound.
const PG_FEE_VA_MAX = 1_000_000 // Rp 1jt flat is already extreme for a PG fee

export function validateFeePct(raw: string, label: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return `${label} is required`
  if (!SPREAD_RE.test(trimmed)) return `${label} must be a number (up to 2 decimals)`
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return `${label} cannot be negative`
  if (n > SPREAD_MAX_INCLUSIVE) return `${label} must be at most ${SPREAD_MAX_INCLUSIVE}%`
  return null
}

// Shared flat-IDR fee validator (PG VA flat + disbursement flat). `label` names
// the field in the error message; both use the same extreme-Rp ceiling.
function validateFlatFee(raw: string, label: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return `${label} is required`
  if (!DECIMAL_RE.test(trimmed)) return `${label} must be a number (up to 4 decimals)`
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return `${label} cannot be negative`
  if (n > PG_FEE_VA_MAX) return `${label} must be at most ${PG_FEE_VA_MAX.toLocaleString()}`
  return null
}

export function validatePgFeeVaFlat(raw: string): string | null {
  return validateFlatFee(raw, 'VA fee')
}

// USDX-245: disbursement fee = Rp flat per payout (referensi sampai provider real).
export function validateDisbursementFeeFlat(raw: string): string | null {
  return validateFlatFee(raw, 'Disbursement fee')
}

export function validateFeeConfigForm(input: {
  mintFeePct: string
  pgFeeVaFlat: string
  pgFeeQrisPct: string
  redeemFeePct: string
  disbursementFeeFlat: string
}): ValidationResult {
  const errors: Record<string, string> = {}
  const mintErr = validateFeePct(input.mintFeePct, 'Mint fee')
  if (mintErr) errors.mintFeePct = mintErr
  const vaErr = validatePgFeeVaFlat(input.pgFeeVaFlat)
  if (vaErr) errors.pgFeeVaFlat = vaErr
  const qrisErr = validateFeePct(input.pgFeeQrisPct, 'QRIS fee')
  if (qrisErr) errors.pgFeeQrisPct = qrisErr
  const redeemErr = validateFeePct(input.redeemFeePct, 'Redeem fee')
  if (redeemErr) errors.redeemFeePct = redeemErr
  const disbErr = validateDisbursementFeeFlat(input.disbursementFeeFlat)
  if (disbErr) errors.disbursementFeeFlat = disbErr
  return { valid: Object.keys(errors).length === 0, errors }
}

// ─── Transparency: reserve ledger + attestation upload ──────────────────────
// Client-side mirror of the validation table in
// catatan/KONTRAK-API-TRANSPARANSI.md § 3. The point of duplicating the rules
// here is a fast, field-level answer — NOT to be the authority. The server
// re-validates, and when it disagrees its message is what the operator sees
// (see LEDGER_ERROR_FIELD below).
//
// Most rules below map 1:1 to an `error.code` from that table. Three do NOT,
// and they are listed here rather than left to be discovered:
//
//   - `reason` maximum length (500)   — the contract sets no ceiling; this is a
//     paste guard so an operator cannot wedge a whole email into an audit field.
//   - `reason` control characters     — see validateLedgerReason.
//   - attestation `title` max (200)   — same reasoning as `reason`.
//
// Everything else that appears here exists because the server enforces it and
// the operator deserves the answer before a round trip. A NEW rule without a
// code needs the same treatment: add it to this list, with why.

/** Contract `amount`: numeric(30,2), sign allowed, at most 2 decimals. */
const LEDGER_AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/
/**
 * `numeric(30,2)` = 30 significant digits, two of them after the point, so at
 * most 28 before it. Postgres rejects a wider value outright, which the backend
 * reports as `422 LEDGER_AMOUNT_INVALID`.
 */
const LEDGER_AMOUNT_MAX_INT_DIGITS = 28
/** Contract `reason`: required, minimum 10 characters. */
export const LEDGER_REASON_MIN_LEN = 10
const LEDGER_REASON_MAX_LEN = 500
/**
 * C0/C1 control characters plus the Unicode bidirectional overrides.
 *
 * `reason` is an audit field: it is the record of why a public number moved, and
 * it is read months later by someone reconstructing a decision. A NUL survives
 * `trim()` and can truncate the string in whatever reads the export next; an
 * RTL override (U+202E and friends) makes the rendered text read differently
 * from the bytes that were stored, which is precisely the property an audit
 * trail must not have.
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_TEXT_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_ATTESTATION_TITLE_LEN = 200

/**
 * Which form field each server `error.code` belongs to, so a 422 from the
 * backend lands under the input that caused it instead of in a generic banner.
 * `null` means "no single field owns this" → render it at form level.
 */
export const LEDGER_ERROR_FIELD: Record<LedgerErrorCode, string | null> = {
  LEDGER_AMOUNT_ZERO: 'amount',
  LEDGER_AMOUNT_INVALID: 'amount',
  LEDGER_REASON_TOO_SHORT: 'reason',
  LEDGER_DATE_IN_FUTURE: 'occurredAt',
  LEDGER_DATE_INVALID: 'occurredAt',
  LEDGER_CURRENCY_UNSUPPORTED: 'currency',
  LEDGER_TYPE_NOT_ALLOWED: 'entryType',
  // No input produced this: the client minted a key outside 16–200 characters.
  // Sending the operator to a field would be a lie — there is no field to fix —
  // so it renders at form level in the dialog.
  LEDGER_IDEMPOTENCY_KEY_INVALID: null,
  // Also field-less, for a different reason: every field may be correct. What
  // clashes is the KEY together with the content, and the fix is a new key, not
  // a new value. Underlining Amount here would send the operator to change a
  // figure they had just finished correcting.
  LEDGER_IDEMPOTENCY_KEY_CONFLICT: null,
}

/**
 * Bounds the backend enforces on `idempotencyKey`
 * (`LEDGER_IDEMPOTENCY_KEY_INVALID`).
 *
 * The MINIMUM is the interesting one. It exists to make a lazy key like
 * `"retry"` impossible, because two unrelated attempts sharing a key means the
 * second one is answered with the first one's entry and a legitimate ledger
 * row is silently dropped — a quieter failure than the duplicate the key was
 * introduced to prevent.
 */
export const LEDGER_IDEMPOTENCY_KEY_MIN_LEN = 16
export const LEDGER_IDEMPOTENCY_KEY_MAX_LEN = 200

/** True when a key would survive the backend's length check. */
export function isValidIdempotencyKey(key: string): boolean {
  return (
    key.length >= LEDGER_IDEMPOTENCY_KEY_MIN_LEN &&
    key.length <= LEDGER_IDEMPOTENCY_KEY_MAX_LEN
  )
}

/** Narrows an arbitrary server code to one this form knows how to place. */
export function isLedgerErrorCode(code: string): code is LedgerErrorCode {
  return code in LEDGER_ERROR_FIELD
}

/**
 * The 409 from § 3: the key is on an entry with DIFFERENT content, so nothing
 * was written and this is not a replay.
 *
 * Singled out from the rest of the table because it is the one code that needs
 * the balance re-read AND a way forward (a new key) rather than a message under
 * an input. Written as a `satisfies` so a typo here fails the type check instead
 * of quietly demoting a 409 to an ordinary error.
 */
export function isLedgerKeyConflict(code: string): boolean {
  return code === ('LEDGER_IDEMPOTENCY_KEY_CONFLICT' satisfies LedgerErrorCode)
}

/**
 * Attestation uploads are PDFs only, capped at **5 MiB**.
 *
 * The number is not a UI preference. The backend signs the presigned URL for
 * exactly this ceiling and rejects a larger `sizeBytes` with
 * `422 ATTESTATION_FILE_TOO_LARGE` (§ 3: "Batasnya 5 MiB, dan angka itu harus
 * sama di kedua sisi"). A looser client limit does not let a bigger file
 * through — it only moves the rejection from a field message to a failed upload
 * after the operator has waited for it.
 *
 * MiB, not MB: 5 × 1024 × 1024, matching the backend's own arithmetic.
 */
export const ATTESTATION_ACCEPTED_MIME = 'application/pdf'
export const ATTESTATION_ACCEPTED_EXTENSION = '.pdf'
export const ATTESTATION_MAX_FILE_BYTES = 5 * 1024 * 1024
/** Display form of the ceiling, so UI copy cannot drift from the constant. */
export const ATTESTATION_MAX_FILE_LABEL = `${ATTESTATION_MAX_FILE_BYTES / (1024 * 1024)} MiB`

/** Local-calendar YYYY-MM-DD for `date` (used to seed the date input). */
export function toDateInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * `amount` rules, in the contract's own order:
 *   not a valid 2-decimal number → LEDGER_AMOUNT_INVALID
 *   wider than numeric(30,2)     → LEDGER_AMOUNT_INVALID
 *   exactly zero                 → LEDGER_AMOUNT_ZERO
 * Negative is explicitly VALID — filing a negative entry is how a correction is
 * made, because the ledger has no UPDATE and no DELETE.
 */
export function validateLedgerAmount(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Amount is required'
  if (!LEDGER_AMOUNT_RE.test(value)) {
    return 'Amount must be a decimal number with at most 2 decimal places'
  }
  // Leading zeros are not significant, so "007.00" is a 1-digit value; Postgres
  // counts what is left after normalisation.
  const [whole = ''] = value.replace('-', '').split('.')
  if (whole.replace(/^0+/, '').length > LEDGER_AMOUNT_MAX_INT_DIGITS) {
    return `Amount can have at most ${LEDGER_AMOUNT_MAX_INT_DIGITS} digits before the decimal point`
  }
  const cents = parseAmountToCents(value)
  if (cents === null) {
    return 'Amount must be a decimal number with at most 2 decimal places'
  }
  if (cents === 0n) return 'Amount cannot be zero'
  return null
}

/**
 * `reason` — required, min 10 chars (LEDGER_REASON_TOO_SHORT), and free of
 * control / bidi-override characters (no server code; see UNSAFE_TEXT_RE).
 *
 * The control-character check runs on the RAW value, before `trim()`: `trim()`
 * removes whitespace, and a NUL is not whitespace — `" ".trim()` is still
 * one character long, so a reason made only of NULs would sail past a
 * length-only check as "10 characters" of nothing.
 */
export function validateLedgerReason(raw: string): string | null {
  if (UNSAFE_TEXT_RE.test(raw)) {
    return 'Reason cannot contain control or text-direction characters'
  }
  const value = raw.trim()
  if (!value) return 'Reason is required'
  if (value.length < LEDGER_REASON_MIN_LEN) {
    return `Reason must be at least ${LEDGER_REASON_MIN_LEN} characters`
  }
  if (value.length > LEDGER_REASON_MAX_LEN) {
    return `Reason must be under ${LEDGER_REASON_MAX_LEN} characters`
  }
  return null
}

/**
 * `occurredAt` — a real calendar date, not in the future (LEDGER_DATE_IN_FUTURE).
 * "Future" is measured in WIB to match the backend's wib-day util: judging this
 * in UTC would reject today's date for anyone filing between 00:00 and 07:00 WIB.
 */
export function validateLedgerOccurredAt(
  raw: string,
  now: Date = new Date()
): string | null {
  const value = raw.trim()
  if (!value) return 'Event date is required'
  if (!ISO_DATE_RE.test(value)) return 'Date must use the YYYY-MM-DD format'
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  // Round-trip guard: `new Date(2026, 1, 31)` silently rolls over to Mar 3.
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return 'Date is not a real calendar date'
  }
  if (isFutureWibDate(value, now)) return 'Event date cannot be in the future'
  return null
}

/** `currency` — ISO-4217 uppercase; only USD this phase (LEDGER_CURRENCY_UNSUPPORTED). */
export function validateLedgerCurrency(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Currency is required'
  if (value !== LEDGER_SUPPORTED_CURRENCY) {
    return `Only ${LEDGER_SUPPORTED_CURRENCY} is supported at this stage`
  }
  return null
}

/** `entryType` — SEED or ADJUSTMENT only (LEDGER_TYPE_NOT_ALLOWED). */
export function validateLedgerEntryType(raw: string): string | null {
  if (!raw) return 'Entry type is required'
  if (!(LEDGER_ENTRY_TYPES_SELECTABLE as readonly string[]).includes(raw)) {
    return 'Entry type must be SEED or ADJUSTMENT'
  }
  return null
}

export function validateLedgerEntryForm(
  input: {
    entryType: string
    amount: string
    currency: string
    reason: string
    occurredAt: string
  },
  now: Date = new Date()
): ValidationResult {
  const errors: Record<string, string> = {}
  const typeErr = validateLedgerEntryType(input.entryType)
  if (typeErr) errors.entryType = typeErr
  const amountErr = validateLedgerAmount(input.amount)
  if (amountErr) errors.amount = amountErr
  const currencyErr = validateLedgerCurrency(input.currency)
  if (currencyErr) errors.currency = currencyErr
  const reasonErr = validateLedgerReason(input.reason)
  if (reasonErr) errors.reason = reasonErr
  const dateErr = validateLedgerOccurredAt(input.occurredAt, now)
  if (dateErr) errors.occurredAt = dateErr
  return { valid: Object.keys(errors).length === 0, errors }
}

// Minimal structural view of a browser `File` so this stays a pure function
// (tests do not need to construct a real File to exercise the rules).
export interface UploadFileLike {
  name: string
  type: string
  size: number
}

/**
 * Name / MIME / size checks on the picked file.
 *
 * These three are all the FILE'S OWN CLAIM about itself, and every one of them
 * is under the picker's control: renaming `payload.exe` to `report.pdf` yields
 * `{ name: 'report.pdf', type: '' }` and passes here. The bytes are checked
 * separately by `looksLikePdf` in lib/transparency.ts, which the upload form
 * awaits before it opens the confirmation. Keep both — this one gives an
 * instant answer, that one gives the truthful one.
 */
export function validateAttestationFile(file: UploadFileLike | null): string | null {
  if (!file) return 'A PDF report file is required'
  const isPdfMime = file.type === ATTESTATION_ACCEPTED_MIME
  // Some browsers report an empty `type` for drag-and-dropped files; fall back
  // to the extension so a genuine PDF is not rejected. Anything else is out.
  const isPdfName = file.name.toLowerCase().endsWith(ATTESTATION_ACCEPTED_EXTENSION)
  if (!isPdfMime && !(file.type === '' && isPdfName)) {
    return 'Only PDF files can be uploaded'
  }
  if (file.size <= 0) return 'File appears to be empty'
  if (file.size > ATTESTATION_MAX_FILE_BYTES) {
    return `File must be at most ${ATTESTATION_MAX_FILE_LABEL}`
  }
  return null
}

/** Message shown when the picked file's bytes are not a PDF. */
export const ATTESTATION_NOT_A_PDF_MESSAGE =
  'This file is not a PDF — its contents do not start with a PDF header'

/** `period` — strict YYYY-MM (server: 422 INVALID_ATTESTATION_PERIOD). */
export function validateAttestationPeriod(
  raw: string,
  now: Date = new Date()
): string | null {
  const value = raw.trim()
  if (!value) return 'Period is required'
  if (!PERIOD_RE.test(value)) return 'Period must use the YYYY-MM format'
  // A report cannot cover a month that has not finished happening. Measured in
  // WIB for the same reason `occurredAt` is.
  if (value > wibToday(now).slice(0, 7)) return 'Period cannot be in the future'
  return null
}

export function validateAttestationUploadForm(
  input: { period: string; title: string; file: UploadFileLike | null },
  now: Date = new Date()
): ValidationResult {
  const errors: Record<string, string> = {}
  const periodErr = validateAttestationPeriod(input.period, now)
  if (periodErr) errors.period = periodErr
  const title = input.title.trim()
  if (!title) {
    errors.title = 'Title is required'
  } else if (title.length > MAX_ATTESTATION_TITLE_LEN) {
    errors.title = `Title must be under ${MAX_ATTESTATION_TITLE_LEN} characters`
  }
  const fileErr = validateAttestationFile(input.file)
  if (fileErr) errors.file = fileErr
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateOtcRedeemForm(input: {
  amount: number | ''
  network: Network | ''
  availableBalance: number
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.network) errors.network = 'Network is required'
  const amt = Number(input.amount)
  if (input.amount === '' || amt <= 0) {
    errors.amount = 'Amount must be greater than 0'
  } else if (amt > input.availableBalance) {
    errors.amount = 'Amount exceeds available balance'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

// sot/api/burn.yaml § CreateBurnRequest — patterns and required fields are
// the contract for POST /api/v1/burn. Keep error keys aligned with form
// field IDs. USDX-46: userName→userId, +amountCurrency.
export const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/

function validateAmountField(amountStr: string, errors: Record<string, string>) {
  if (!amountStr) {
    errors.amount = 'Amount is required'
    return
  }
  const amt = Number(amountStr)
  if (!Number.isFinite(amt) || amt <= 0) {
    errors.amount = 'Amount must be greater than 0'
    return
  }
  // sot/conventions.md § Decimals: USDX uses 6 decimals; IDR uses 2.
  // We accept up to 6 decimals here (the BE will normalize for IDR input).
  const [, fraction = ''] = amountStr.split('.')
  if (fraction.length > 6) {
    errors.amount = 'Amount supports at most 6 decimal places'
  }
}

function validateUserAddressField(
  userAddress: string,
  errors: Record<string, string>
) {
  // sot/conventions.md L114-115: store in checksummed format, validate at input.
  // Lenient: all-lowercase atau all-uppercase = format-only check (no checksum
  // to verify). Mixed-case = harus match EIP-55 (viem.getAddress canonical form).
  const trimmed = userAddress.trim()
  if (!trimmed) {
    errors.userAddress = 'Wallet address is required'
    return
  }
  if (!EVM_ADDRESS_RE.test(trimmed)) {
    errors.userAddress = 'Invalid EVM address (expect 0x + 40 hex)'
    return
  }
  const hex = trimmed.slice(2)
  const isAllLower = hex === hex.toLowerCase()
  const isAllUpper = hex === hex.toUpperCase()
  if (!isAllLower && !isAllUpper) {
    try {
      if (getAddress(trimmed) !== trimmed) {
        errors.userAddress = 'Address checksum is invalid (EIP-55)'
      }
    } catch {
      errors.userAddress = 'Address checksum is invalid (EIP-55)'
    }
  }
}

export function validateBurnRequestForm(input: {
  userId: string
  userAddress: string
  amount: string
  amountCurrency: AmountCurrency | ''
  chain: RequestChain | ''
  depositTxHash: string
  bankName: string
  bankAccount: string
  notes?: string
}): ValidationResult {
  const errors: Record<string, string> = {}

  if (!input.userId.trim()) errors.userId = 'User is required'

  if (!input.userAddress.trim()) {
    errors.userAddress = 'User wallet address is required'
  } else if (!isAddress(input.userAddress.trim())) {
    errors.userAddress = 'Invalid wallet address'
  }

  validateAmountField(input.amount.trim(), errors)
  if (!input.amountCurrency) errors.amountCurrency = 'Currency is required'

  if (!input.chain) errors.chain = 'Chain is required'

  if (!input.depositTxHash.trim()) {
    errors.depositTxHash = 'Deposit TX hash is required'
  } else if (!TX_HASH_RE.test(input.depositTxHash.trim())) {
    errors.depositTxHash = 'Invalid TX hash (expected 0x + 64 hex chars)'
  }

  if (!input.bankName.trim()) errors.bankName = 'Bank name is required'
  if (!input.bankAccount.trim()) errors.bankAccount = 'Bank account is required'

  return { valid: Object.keys(errors).length === 0, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — mint request form (sot/openapi.yaml § CreateMintRequest)
// ─────────────────────────────────────────────────────────────────────────────

// sot/api/staff.yaml § CreateStaff — name + email + password (>=8) + role
// all required. Admin-only endpoint (BE returns 403 otherwise).
const PASSWORD_MIN_LEN = 8

export function validateStaffCreateForm(input: {
  name: string
  email: string
  password: string
  role: StaffRole | ''
}): ValidationResult {
  const errors: Record<string, string> = {}
  validateName(input.name, 'name', 'Name', errors)
  validateEmail(input.email, errors)
  if (!input.password) {
    errors.password = 'Password is required'
  } else if (input.password.length < PASSWORD_MIN_LEN) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LEN} characters`
  }
  if (!input.role) errors.role = 'Role is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

// sot/api/staff.yaml § UpdateStaff — all fields optional, but the form
// always sends name + role + isActive together so we validate them as
// required at the form layer.
export function validateStaffEditForm(input: {
  name: string
  role: StaffRole | ''
}): ValidationResult {
  const errors: Record<string, string> = {}
  validateName(input.name, 'name', 'Name', errors)
  if (!input.role) errors.role = 'Role is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

// sot/api/users.yaml § CreateUser/UpdateUser. USDX-47 enforces:
// USDX-156 — sot/api/users.yaml § CreateUser.phone: optional at admin-create,
// format `+62xxx` or `08xxx` (backend normalizes to +62). Empty = not provided.
// Length bounds: Indonesian numbers are 9–13 digits after the prefix.
const ID_PHONE_RE = /^(\+62\d{8,12}|08\d{7,11})$/

export function validateOptionalIdPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s()-]/g, '')
  if (!cleaned) return null
  if (!ID_PHONE_RE.test(cleaned)) {
    return 'Use +62xxx or 08xxx format'
  }
  return null
}

// - name required, max 255 chars (AC6)
// - email required + format check (S4 + S5: required in create AND edit per
//   judgement — empty email would break Phase-2 login at sot/phase-1.md L341)
// - entityType required when explicitly provided as null/empty (S4 + S5)
// - notes max 2000 chars (AC7)
// - wallets max 50 enforced separately by validateUserWalletsLimit
export function validateUserForm(input: {
  name: string
  email: string
  entityType?: string
  notes?: string
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.name.trim()) {
    errors.name = 'Name is required'
  } else if (input.name.length > MAX_USER_NAME_LEN) {
    errors.name = `Name must be under ${MAX_USER_NAME_LEN} characters`
  }
  if (!input.email.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(input.email)) {
    errors.email = 'Invalid email format'
  }
  if (input.entityType !== undefined && !input.entityType) {
    errors.entityType = 'Entity type is required'
  }
  if (input.notes !== undefined && input.notes.length > MAX_USER_NOTES_LEN) {
    errors.notes = `Notes must be under ${MAX_USER_NOTES_LEN} characters`
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

// USDX-47 S8 + AC10: wallets max 50 per user. FE pre-check before POST so the
// operator sees the limit immediately; BE 422 is the safety net for races.
export function validateUserWalletsLimit(currentCount: number, addingCount = 1): string | null {
  if (currentCount + addingCount > MAX_USER_WALLETS) {
    return `Maximum ${MAX_USER_WALLETS} wallets per user`
  }
  return null
}

export const USER_LIMITS = {
  MAX_NAME_LEN: MAX_USER_NAME_LEN,
  MAX_NOTES_LEN: MAX_USER_NOTES_LEN,
  MAX_WALLETS: MAX_USER_WALLETS,
} as const

// sot/openapi.yaml § CreateUserWallet — both fields required; address must
// pass the same EIP-55 checksum check used for mint requests.
export function validateUserWalletForm(input: {
  chain: string
  address: string
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.chain.trim()) {
    errors.chain = 'Chain is required'
  }
  const trimmedAddress = input.address.trim()
  if (!trimmedAddress) {
    errors.address = 'Wallet address is required'
  } else if (!EVM_ADDRESS_RE.test(trimmedAddress)) {
    errors.address = 'Invalid EVM address (expect 0x + 40 hex)'
  } else {
    const hex = trimmedAddress.slice(2)
    const isAllLower = hex === hex.toLowerCase()
    const isAllUpper = hex === hex.toUpperCase()
    if (!isAllLower && !isAllUpper) {
      try {
        if (getAddress(trimmedAddress) !== trimmedAddress) {
          errors.address = 'Address checksum is invalid (EIP-55)'
        }
      } catch {
        errors.address = 'Address checksum is invalid (EIP-55)'
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateMintRequestForm(input: {
  userId: string
  userAddress: string
  amount: string
  amountCurrency: AmountCurrency | ''
  chain: string
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.userId.trim()) {
    errors.userId = 'User is required'
  }
  validateUserAddressField(input.userAddress, errors)
  validateAmountField(input.amount.trim(), errors)
  if (!input.amountCurrency) errors.amountCurrency = 'Currency is required'
  if (!input.chain.trim()) {
    errors.chain = 'Chain is required'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

// USDX-485 — form kontak on-call insiden uang.
//
// `contactValue` SENGAJA tidak divalidasi per-kanal: kanalnya bisa Slack, nomor
// kantor, nomor luar negeri, atau nomor darurat vendor, dan memaksakan bentuk
// Indonesia (validateOptionalIdPhone) akan menolak kontak yang sah lalu
// meninggalkan sebuah kategori tanpa penanggung jawab. Daftar yang salah ketik
// masih bisa diperbaiki; kategori yang kosong tidak bisa ditelepon. Batasnya
// mengikuti kolom backend (name/role 120, contact_value 200).
const MAX_ONCALL_TEXT_LEN = 120
const MAX_ONCALL_VALUE_LEN = 200

export function validateOncallContactForm(input: {
  name: string
  role: string
  channel: OncallChannel | ''
  contactValue: string
  categories: OncallIncidentCategory[]
}): ValidationResult {
  const errors: Record<string, string> = {}

  if (!input.name.trim()) {
    errors.name = 'Name is required'
  } else if (input.name.length > MAX_ONCALL_TEXT_LEN) {
    errors.name = `Name must be under ${MAX_ONCALL_TEXT_LEN} characters`
  }

  if (!input.role.trim()) {
    errors.role = 'Role is required'
  } else if (input.role.length > MAX_ONCALL_TEXT_LEN) {
    errors.role = `Role must be under ${MAX_ONCALL_TEXT_LEN} characters`
  }

  if (!input.channel) errors.channel = 'Channel is required'

  if (!input.contactValue.trim()) {
    errors.contactValue = 'Contact value is required'
  } else if (input.contactValue.length > MAX_ONCALL_VALUE_LEN) {
    errors.contactValue = `Contact value must be under ${MAX_ONCALL_VALUE_LEN} characters`
  }

  // Kontak tanpa kategori tidak akan pernah ikut di satu alarm pun — ia terlihat
  // terdaftar tapi secara efektif tidak ada.
  if (input.categories.length === 0) {
    errors.categories = 'Pick at least one incident category'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — KYB (business entity due diligence), manual back-office entry.
//
// KYB has no consumer app behind it: a USDX operator types the entity's data in
// from documents (decision Mas Yan — KYB manual, bukan API). So this validation
// is the first gate the data meets, and the rule that matters most is not "is
// this field filled":
//
//   UBO ownership. A KYB record with no UBO is not a due-diligence record at
//   all — the entire point is knowing who ultimately owns the entity. And the
//   declared percentages cannot exceed 100: a sheet claiming two people own 80%
//   each is a misreading of the deed, and catching it here costs nothing
//   compared with catching it in an audit.
//
// The reject reason rule lives at the bottom of this file and is applied by the
// mutation hook as well as the dialog — see `useRejectKyb`.
// ─────────────────────────────────────────────────────────────────────────────
//
// USDX-546 — every ceiling below is now the BACKEND's ceiling, not a guess.
// `POST /api/v1/kyb` is live on dev (backend PR #271), so a limit that is wider
// here than in `CreateKybDto` does not "allow more": it trades an inline message
// the operator can act on for a 400 that arrives after the whole form was typed.
// Sources are named per constant so the next edit can check them.
const MAX_KYB_NAME_LEN = 255 // CreateKybDto @MaxLength(255) — entityName
const MIN_KYB_NAME_LEN = 3 // CreateKybDto @MinLength(3)
const MAX_KYB_SECTOR_LEN = 120 // CreateKybDto @MaxLength(120)
const MAX_KYB_ADDRESS_LEN = 255 // CreateKybDto @MaxLength(255) — entity + UBO
const MAX_KYB_WEBSITE_LEN = 255 // CreateKybDto @MaxLength(255)
const MAX_KYB_UBOS = 20 // CreateKybDto @ArrayMaxSize(20)
// USDX-605 — batas blok Pasal 33 (3), disalin dari `CreateKybUboDto` dan
// `sot/api/kyb.yaml § CreateKybUbo`. Angkanya 200 / 100 / 500 / 32 dan bukan
// tebakan: batas FE yang lebih ketat dari kontraknya menolak masukan yang server
// justru terima, dan kolomnya `text` — tidak ada apa pun di database yang
// menuntut angka lebih kecil.
const MAX_KYB_UBO_ALIAS_LEN = 200 // CreateKybUboDto @MaxLength(200)
const MAX_KYB_UBO_NAME_LEN = 100 // CreateKybUboDto @MaxLength(100) — birthPlace
const MAX_KYB_UBO_EMPLOYER_ADDRESS_LEN = 500 // CreateKybUboDto @MaxLength(500)
// NIB: DIGITS ONLY. `@IsNumberString({ no_symbols: true })` — the backend
// normalises the value to digits before hashing it, so "8120-0123-45678" and
// "812001234 5678" are the same company; accepting punctuation here would let an
// operator file a spelling the API refuses.
const KYB_REGISTRATION_RE = /^[0-9]{8,32}$/
// NPWP badan: 15 digits (pre-2024) or 16 (NIK-based); punctuation optional. The
// DTO only asks for 8-32 characters, so this stays the stricter of the two.
const KYB_TAX_ID_RE = /^[0-9.\-\s]{15,25}$/
const KYB_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// ISO 3166-1 alpha-2, matching the DTO regex AND the `kyb_country_iso3166`
// CHECK constraint. Uppercase only — the constraint is on the stored value.
const KYB_COUNTRY_RE = /^[A-Z]{2}$/
// 0.01-100.00 with AT MOST two decimals — `kyc_ubo.ownership_pct` is
// `numeric(5,2)`, so a third decimal is rounded away by Postgres and the figure
// on screen stops being the figure on file. Same regex as the DTO.
const KYB_OWNERSHIP_PCT_RE = /^(100(\.0{1,2})?|[1-9]\d?(\.\d{1,2})?|0\.(0[1-9]|[1-9]\d?))$/

/**
 * Satu baris UBO di form KYB — SEMUANYA string, karena semuanya berasal dari
 * `<input>` atau `<Select>`. Nilai kosong `''` berarti "belum diisi"; enumnya
 * divalidasi sebagai wajib-terisi di sini dan sebagai nilai tertutup oleh DTO
 * backend (`@IsIn`), jadi daftar nilainya tidak disalin dua kali.
 *
 * Blok Pasal 33 ayat (3) (USDX-605) ada di sini karena `sot/api/kyb.yaml
 * § CreateKybUbo` menandainya `required` dan backend menerimanya sejak USDX-604 —
 * sampai form ini mengirimnya, kartu review USDX-587 menampilkan em dash untuk
 * kolom yang memang tidak pernah ada yang mengisi.
 */
export interface KybUboFormInput {
  firstName: string
  lastName: string
  ownershipPct: string
  identityNumber: string
  country: string
  addressLine1: string
  addressLine2: string
  // ── Pasal 33 (3) huruf a ──────────────────────────────────────────────────
  /** Angka 1 — "termasuk nama alias". Opsional: tidak semua orang punya alias. */
  aliasName: string
  birthPlace: string
  /** ISO `YYYY-MM-DD`. */
  dob: string
  nationality: string
  occupation: string
  /** Angka 8 — "jika ada", jadi opsional. */
  employerAddress: string
  employerPhone: string
  gender: string
  maritalStatus: string
  // ── Pasal 33 (3) huruf b & c ──────────────────────────────────────────────
  sourceOfFunds: string
  annualIncomeRange: string
  netWorthRange: string
  // ── Pasal 33 (3) huruf d + ayat (7)/(8) ───────────────────────────────────
  legalRelationship: string
  cascadeStep: string
}

export interface KybFormInput {
  userId: string
  entityName: string
  entityForm: string
  country: string
  registrationNumber: string
  taxId: string
  establishmentDate: string
  businessSector: string
  registeredAddress: string
  operationalAddress: string
  website: string
  phone: string
  // ── Pasal 25 (1) b angka 5, 8, 9 + Pasal 27 (1) — USDX-605 ────────────────
  /** Angka 5 — **tempat** pendirian. Tanggalnya `establishmentDate`. */
  incorporationPlace: string
  sourceOfFunds: string
  transactionPurpose: string
  /**
   * `'YES' | 'NO' | ''` — TIGA nilai, bukan boolean, dan `''` bukan default
   * tersembunyi: kontraknya menulis "tidak punya default" karena menebak "bukan
   * usaha kecil" menahan nasabah dengan syarat yang tidak diwajibkan kepadanya,
   * dan menebak "usaha kecil" melepas enam dokumen yang diwajibkan pasal. Petugas
   * harus memilih.
   */
  isMicroOrSmall: string
  ubos: KybUboFormInput[]
}

/**
 * UBO errors are keyed `ubo.<index>.<field>` so the form can put each message
 * beside the input that produced it. A flat `ubos` key would tell the operator
 * "something in the UBO list is wrong" about a list of twenty rows.
 */
export function kybUboErrorKey(index: number, field: string): string {
  return `ubo.${index}.${field}`
}

export function validateKybForm(input: KybFormInput): ValidationResult {
  const errors: Record<string, string> = {}

  if (!input.userId.trim()) errors.userId = 'Legal-entity user is required'

  if (!input.entityName.trim()) {
    errors.entityName = 'Entity name is required'
  } else if (input.entityName.trim().length < MIN_KYB_NAME_LEN) {
    errors.entityName = `Entity name must be at least ${MIN_KYB_NAME_LEN} characters`
  } else if (input.entityName.length > MAX_KYB_NAME_LEN) {
    errors.entityName = `Entity name must be under ${MAX_KYB_NAME_LEN} characters`
  }

  if (!input.entityForm.trim()) errors.entityForm = 'Legal form is required'

  if (!input.country.trim()) {
    errors.country = 'Country is required'
  } else if (!KYB_COUNTRY_RE.test(input.country.trim())) {
    errors.country = 'Country must be an ISO 3166-1 alpha-2 code, uppercase (e.g. ID)'
  }

  if (!input.registrationNumber.trim()) {
    errors.registrationNumber = 'Registration number (NIB) is required'
  } else if (!KYB_REGISTRATION_RE.test(input.registrationNumber.trim())) {
    errors.registrationNumber = 'Registration number must be 8-32 digits, no dashes or spaces'
  }

  if (!input.taxId.trim()) {
    errors.taxId = 'Entity NPWP is required'
  } else if (!KYB_TAX_ID_RE.test(input.taxId.trim())) {
    errors.taxId = 'NPWP must be 15-16 digits (dots / dashes allowed)'
  }

  if (!input.establishmentDate.trim()) {
    errors.establishmentDate = 'Establishment date is required'
  } else if (!KYB_ISO_DATE_RE.test(input.establishmentDate.trim())) {
    errors.establishmentDate = 'Establishment date must be YYYY-MM-DD'
  } else if (isFutureWibDate(input.establishmentDate.trim())) {
    // An entity cannot have been established tomorrow. Judged in WIB, like every
    // other date in this app (lib/transparency.ts).
    errors.establishmentDate = 'Establishment date cannot be in the future'
  }

  if (!input.businessSector.trim()) {
    errors.businessSector = 'Business sector is required'
  } else if (input.businessSector.length > MAX_KYB_SECTOR_LEN) {
    errors.businessSector = `Business sector must be under ${MAX_KYB_SECTOR_LEN} characters`
  }

  if (!input.registeredAddress.trim()) {
    errors.registeredAddress = 'Registered address is required'
  } else if (input.registeredAddress.length > MAX_KYB_ADDRESS_LEN) {
    errors.registeredAddress = `Registered address must be under ${MAX_KYB_ADDRESS_LEN} characters`
  }

  if (!input.operationalAddress.trim()) {
    errors.operationalAddress = 'Operational address is required'
  } else if (input.operationalAddress.length > MAX_KYB_ADDRESS_LEN) {
    errors.operationalAddress = `Operational address must be under ${MAX_KYB_ADDRESS_LEN} characters`
  }

  // Website is optional (the `kyb.website` column is nullable); only its shape
  // is checked when present.
  const website = input.website.trim()
  if (website && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(website)) {
    errors.website = 'Website must start with http:// or https://'
  } else if (website.length > MAX_KYB_WEBSITE_LEN) {
    errors.website = `Website must be under ${MAX_KYB_WEBSITE_LEN} characters`
  }

  if (!input.phone.trim()) {
    errors.phone = 'Phone is required'
  } else if (!PHONE_RE.test(input.phone.trim())) {
    errors.phone = 'Phone must be 10-15 digits (leading + allowed)'
  }

  // ── Pasal 25 (1) b angka 5, 8, 9 + Pasal 27 (1) — USDX-605 ────────────────
  // `required` di `sot/api/kyb.yaml § CreateKybRequest`. Keempatnya diterima
  // backend sejak USDX-604 dan tidak pernah dikirim form ini.
  if (!input.incorporationPlace.trim()) {
    errors.incorporationPlace = 'Place of incorporation is required'
  } else if (input.incorporationPlace.trim().length < 2) {
    errors.incorporationPlace = 'Place of incorporation must be at least 2 characters'
  } else if (input.incorporationPlace.length > MAX_KYB_SECTOR_LEN) {
    errors.incorporationPlace = `Place of incorporation must be under ${MAX_KYB_SECTOR_LEN} characters`
  }

  if (!input.sourceOfFunds.trim()) errors.sourceOfFunds = 'Source of funds is required'
  if (!input.transactionPurpose.trim()) {
    errors.transactionPurpose = 'Purpose of the business relationship is required'
  }
  // Tidak ada default: lihat catatan di `KybFormInput.isMicroOrSmall`.
  if (input.isMicroOrSmall !== 'YES' && input.isMicroOrSmall !== 'NO') {
    errors.isMicroOrSmall = 'Answer whether this is a micro/small enterprise'
  }

  // ── UBOs ──
  if (input.ubos.length === 0) {
    errors.ubos = 'At least one UBO is required'
  } else if (input.ubos.length > MAX_KYB_UBOS) {
    errors.ubos = `At most ${MAX_KYB_UBOS} UBOs`
  }

  let ownershipTotal = 0
  let ownershipParsable = input.ubos.length > 0
  input.ubos.forEach((ubo, i) => {
    if (!ubo.firstName.trim())
      errors[kybUboErrorKey(i, 'firstName')] = 'First name is required'
    if (!ubo.lastName.trim()) errors[kybUboErrorKey(i, 'lastName')] = 'Last name is required'

    const pctRaw = ubo.ownershipPct.trim()
    const pct = Number(pctRaw)
    if (!pctRaw) {
      errors[kybUboErrorKey(i, 'ownershipPct')] = 'Ownership % is required'
      ownershipParsable = false
    } else if (!KYB_OWNERSHIP_PCT_RE.test(pctRaw)) {
      // One rule, two failures it has to separate: out of range, and more
      // precision than `numeric(5,2)` can hold. Both are 400s from the API, and
      // the second one is the surprising one — say which it is.
      errors[kybUboErrorKey(i, 'ownershipPct')] =
        'Ownership % must be a decimal between 0.01 and 100.00 with at most 2 decimals'
      ownershipParsable = false
    } else {
      ownershipTotal += pct
    }

    // KTP is 16 digits, a passport number is shorter. This is PII the operator is
    // copying off a document, so a length/charset check is the most that can be
    // verified here.
    const idNumber = ubo.identityNumber.trim()
    if (!idNumber) {
      errors[kybUboErrorKey(i, 'identityNumber')] = 'Identity number is required'
    } else if (!/^[0-9]{8,20}$/.test(idNumber)) {
      errors[kybUboErrorKey(i, 'identityNumber')] = 'Identity number must be 8-20 digits'
    }

    if (!ubo.country.trim()) {
      errors[kybUboErrorKey(i, 'country')] = 'Country is required'
    } else if (!KYB_COUNTRY_RE.test(ubo.country.trim())) {
      errors[kybUboErrorKey(i, 'country')] =
        'Country must be an ISO 3166-1 alpha-2 code, uppercase (e.g. ID)'
    }

    if (!ubo.addressLine1.trim()) {
      errors[kybUboErrorKey(i, 'addressLine1')] = 'Address is required'
    } else if (ubo.addressLine1.length > MAX_KYB_ADDRESS_LEN) {
      errors[kybUboErrorKey(i, 'addressLine1')] =
        `Address must be under ${MAX_KYB_ADDRESS_LEN} characters`
    }
    if (ubo.addressLine2.length > MAX_KYB_ADDRESS_LEN) {
      errors[kybUboErrorKey(i, 'addressLine2')] =
        `Address must be under ${MAX_KYB_ADDRESS_LEN} characters`
    }

    // ── Pasal 33 ayat (3) selengkapnya (USDX-605) ───────────────────────────
    // Wajibnya bukan selera form: `required` di `sot/api/kyb.yaml
    // § CreateKybUbo`. Yang TIDAK ada di daftar itu — alias, alamat & telepon
    // tempat kerja — tetap opsional di sini, dan itu ikut pasalnya: angka 8
    // berbunyi "jika ada", dan tidak semua orang punya nama alias.
    if (!ubo.birthPlace.trim()) {
      errors[kybUboErrorKey(i, 'birthPlace')] = 'Place of birth is required'
    } else if (ubo.birthPlace.length > MAX_KYB_UBO_NAME_LEN) {
      errors[kybUboErrorKey(i, 'birthPlace')] =
        `Place of birth must be under ${MAX_KYB_UBO_NAME_LEN} characters`
    }

    const dob = ubo.dob.trim()
    if (!dob) {
      errors[kybUboErrorKey(i, 'dob')] = 'Date of birth is required'
    } else if (!KYB_ISO_DATE_RE.test(dob)) {
      errors[kybUboErrorKey(i, 'dob')] = 'Date of birth must be YYYY-MM-DD'
    } else if (isFutureWibDate(dob)) {
      // Seseorang tidak bisa lahir besok. Dinilai di WIB, sama dengan setiap
      // tanggal lain di aplikasi ini.
      errors[kybUboErrorKey(i, 'dob')] = 'Date of birth cannot be in the future'
    }

    if (!ubo.nationality.trim()) {
      errors[kybUboErrorKey(i, 'nationality')] = 'Nationality is required'
    } else if (!KYB_COUNTRY_RE.test(ubo.nationality.trim())) {
      errors[kybUboErrorKey(i, 'nationality')] =
        'Nationality must be an ISO 3166-1 alpha-2 code, uppercase (e.g. ID)'
    }

    if (ubo.aliasName.length > MAX_KYB_UBO_ALIAS_LEN) {
      errors[kybUboErrorKey(i, 'aliasName')] =
        `Alias must be under ${MAX_KYB_UBO_ALIAS_LEN} characters`
    }
    if (ubo.employerAddress.length > MAX_KYB_UBO_EMPLOYER_ADDRESS_LEN) {
      errors[kybUboErrorKey(i, 'employerAddress')] =
        `Employer address must be under ${MAX_KYB_UBO_EMPLOYER_ADDRESS_LEN} characters`
    }
    const employerPhone = ubo.employerPhone.trim()
    if (employerPhone && !PHONE_RE.test(employerPhone)) {
      errors[kybUboErrorKey(i, 'employerPhone')] =
        'Employer phone must be 10-15 digits (leading + allowed)'
    }

    // Enum tertutup: yang diperiksa di sini hanya "sudah dipilih atau belum".
    // Daftar nilainya milik `@IsIn` di DTO backend dan pg enum di belakangnya —
    // menyalinnya ke sini akan membuat salinan kedua yang bisa basi, persis
    // kesalahan yang membuat `PARTNER_OCCUPATIONS` menolak 95 nilai sah (USDX-603).
    const REQUIRED_UBO_CHOICES: ReadonlyArray<[keyof KybUboFormInput, string]> = [
      ['occupation', 'Occupation is required'],
      ['gender', 'Gender is required'],
      ['maritalStatus', 'Marital status is required'],
      ['sourceOfFunds', 'Source of funds is required'],
      ['annualIncomeRange', 'Annual income range is required'],
      ['netWorthRange', 'Net worth range is required'],
      ['legalRelationship', 'Legal relationship is required'],
      ['cascadeStep', 'Cascading-test step is required'],
    ]
    for (const [field, message] of REQUIRED_UBO_CHOICES) {
      if (!String(ubo[field]).trim()) errors[kybUboErrorKey(i, field)] = message
    }
  })

  // Only meaningful once every row parsed — otherwise the total is a partial sum
  // and the message would blame the wrong thing.
  if (ownershipParsable && ownershipTotal > 100.0001) {
    errors.ubos = `Declared ownership totals ${ownershipTotal.toFixed(2)}% — it cannot exceed 100%`
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export const KYB_REJECT_REASON_MAX = 500

/**
 * Ten characters, and it is not a style preference: `RejectKybDto` declares
 * `@MinLength(10)`, the service re-checks it (`REJECTION_REASON_TOO_SHORT`), and
 * TWO database CHECKs refuse anything shorter after trimming
 * (`kyb_rejected_requires_reason`, `kyb_reviews_rejected_requires_reason`).
 * Mirroring it here is what keeps the operator's typed text on screen instead of
 * trading it for a 400 — and "no" is not a reason the entity can act on anyway.
 */
export const KYB_REJECT_REASON_MIN = 10

/**
 * The reject-reason rule as a pure function, so the dialog, the mutation hook and
 * the tests all read the SAME rule. Returning the trimmed value is the point: a
 * caller cannot accidentally send `"   "` past a `valid` check.
 */
export function validateKybRejectReason(
  reason: string,
): { valid: true; reason: string } | { valid: false; error: string } {
  const trimmed = reason.trim()
  if (!trimmed) return { valid: false, error: 'Rejection reason is required' }
  if (trimmed.length < KYB_REJECT_REASON_MIN) {
    return {
      valid: false,
      error: `Reason must be at least ${KYB_REJECT_REASON_MIN} characters — the entity is told this`,
    }
  }
  if (trimmed.length > KYB_REJECT_REASON_MAX) {
    return {
      valid: false,
      error: `Reason must be at most ${KYB_REJECT_REASON_MAX} characters`,
    }
  }
  return { valid: true, reason: trimmed }
}

// ─────────────────────────────────────────────────────────────────────────────
// USDX-588 — alasan keputusan screening.
// ─────────────────────────────────────────────────────────────────────────────

/** `@MaxLength(1000)` pada `DecideScreeningDto`. */
export const SCREENING_REASON_MAX = 1000

/**
 * Sepuluh karakter, dan ini bukan preferensi gaya: `DecideScreeningDto`
 * mendeklarasikan `@MinLength(10)` dan CHECK `screening_results_row_shape` di
 * database menolak yang lebih pendek. Alasan sebenarnya ada di POJK 8/2023
 * Pasal 63 ayat (2) huruf c — alasan inilah "hasil analisis" yang wajib
 * ditatausahakan, dan keputusan melepaskan atau menahan seseorang dari daftar
 * teroris dibaca ulang pemeriksa bertahun kemudian. Kata "ok" tidak menjawab
 * apa pun saat itu terjadi.
 */
export const SCREENING_REASON_MIN = 10

/**
 * Aturan alasan keputusan sebagai fungsi murni, supaya dialog, hook mutasi, dan
 * tesnya membaca aturan yang SAMA. Mengembalikan nilai yang sudah di-trim
 * adalah intinya: pemanggil tidak bisa tanpa sengaja mengirim `"          "`
 * melewati pemeriksaan `valid`, yang panjangnya persis cukup untuk lolos
 * `MinLength` di server tapi kosong bagi siapa pun yang membacanya nanti.
 */
export function validateScreeningReason(
  reason: string,
): { valid: true; reason: string } | { valid: false; error: string } {
  const trimmed = reason.trim()
  if (!trimmed) return { valid: false, error: 'Alasan keputusan wajib diisi' }
  if (trimmed.length < SCREENING_REASON_MIN) {
    return {
      valid: false,
      error: `Alasan minimal ${SCREENING_REASON_MIN} karakter — inilah hasil analisis yang wajib ditatausahakan`,
    }
  }
  if (trimmed.length > SCREENING_REASON_MAX) {
    return {
      valid: false,
      error: `Alasan maksimal ${SCREENING_REASON_MAX} karakter`,
    }
  }
  return { valid: true, reason: trimmed }
}
