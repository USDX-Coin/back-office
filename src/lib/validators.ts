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
// Every rule below maps 1:1 to an `error.code` from that table. If a rule here
// has no code, it does not belong here.

/** Contract `amount`: numeric(30,2), sign allowed, at most 2 decimals. */
const LEDGER_AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/
/** Contract `reason`: required, minimum 10 characters. */
export const LEDGER_REASON_MIN_LEN = 10
const LEDGER_REASON_MAX_LEN = 500
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_ATTESTATION_TITLE_LEN = 200

/**
 * Which form field each server `error.code` belongs to, so a 422 from the
 * backend lands under the input that caused it instead of in a generic banner.
 * `null` means "no single field owns this" → render it at form level.
 */
export const LEDGER_ERROR_FIELD: Record<LedgerErrorCode, string> = {
  LEDGER_AMOUNT_ZERO: 'amount',
  LEDGER_AMOUNT_INVALID: 'amount',
  LEDGER_REASON_TOO_SHORT: 'reason',
  LEDGER_DATE_IN_FUTURE: 'occurredAt',
  LEDGER_DATE_INVALID: 'occurredAt',
  LEDGER_CURRENCY_UNSUPPORTED: 'currency',
  LEDGER_TYPE_NOT_ALLOWED: 'entryType',
}

/** Narrows an arbitrary server code to one this form knows how to place. */
export function isLedgerErrorCode(code: string): code is LedgerErrorCode {
  return code in LEDGER_ERROR_FIELD
}

/** Attestation uploads are PDFs only, capped at 10 MB (client-side guard). */
export const ATTESTATION_ACCEPTED_MIME = 'application/pdf'
export const ATTESTATION_ACCEPTED_EXTENSION = '.pdf'
export const ATTESTATION_MAX_FILE_BYTES = 10 * 1024 * 1024

/** Local-calendar YYYY-MM-DD for `date` (used to seed the date input). */
export function toDateInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * `amount` rules, in the contract's own order:
 *   not a valid 2-decimal number → LEDGER_AMOUNT_INVALID
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
  const cents = parseAmountToCents(value)
  if (cents === null) {
    return 'Amount must be a decimal number with at most 2 decimal places'
  }
  if (cents === 0n) return 'Amount cannot be zero'
  return null
}

/** `reason` — required, min 10 chars (LEDGER_REASON_TOO_SHORT). */
export function validateLedgerReason(raw: string): string | null {
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
    return `File must be at most ${ATTESTATION_MAX_FILE_BYTES / (1024 * 1024)} MB`
  }
  return null
}

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
