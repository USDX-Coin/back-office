import { http, HttpResponse } from 'msw'
import { isAddress } from 'viem'
import { canHandleAmountIdr } from '@/lib/roleAuth'
import type {
  Customer,
  KycDetail,
  KycListItem,
  KycReviewLog,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  RateConfig,
  RateMode,
  UpdateRateConfig,
  FeeConfig,
  UpdateFeeConfig,
  ReserveLedgerEntry,
  CreateAttestationInput,
  AttestationReport,
  RequestDetail,
  RequestListItem,
  OrderDetail,
  OrderListItem,
  OncallContact,
  CreateOncallContact,
  UpdateOncallContact,
} from '@/lib/types'
import { canManageRate, canManageFeeConfig, canManageTransparency, canManageOncallContacts } from '@/lib/types'
import {
  createKycReviewLog,
  createMockCustomerList,
  createMockKycDetailState,
  createMockKycList,
  createMockStaffList,
  createMockOtcTransactions,
  createMockChainConfigs,
  createMockRequests,
  createOtcMintTransaction,
  createOtcRedeemTransaction,
  createBurnRequestFromSubmission,
  createInitialRateHistory,
  createRateConfig,
  computeRateInfo,
  createInitialOncallContacts,
  createOncallContact,
  createInitialFeeHistory,
  createFeeConfig,
  createLedgerEntry,
  createInitialLedgerEntries,
  createAttestationReport,
  createInitialAttestations,
  computeDashboardStats,
  customerToPhaseOneUser,
  createMintFromRequest,
  createMockOrders,
  MANAGER_THRESHOLD_IDR,
} from './data'

// ─── Stores ───
let customerStore: Customer[] = createMockCustomerList()
let staffStore: Staff[] = createMockStaffList()
let otcMintStore: OtcMintTransaction[]
let otcRedeemStore: OtcRedeemTransaction[]
// USDX-485 — direktori kontak on-call insiden uang (audit P1-18).
let oncallStore: OncallContact[] = createInitialOncallContacts()
;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
let rateHistory: RateConfig[] = createInitialRateHistory(staffStore[0]?.id ?? 'seed')
let feeHistory: FeeConfig[] = createInitialFeeHistory(staffStore[0]?.id ?? 'seed')
let reserveLedger: ReserveLedgerEntry[] = createInitialLedgerEntries()
let attestations: AttestationReport[] = createInitialAttestations()
let requestList: RequestListItem[]
let requestDetails: Map<string, RequestDetail>
;({ list: requestList, details: requestDetails } = createMockRequests(customerStore, staffStore))
let orderList: OrderListItem[]
let orderDetails: Map<string, OrderDetail>
;({ list: orderList, details: orderDetails } = createMockOrders(customerStore))
let kycList: KycListItem[] = createMockKycList()
let kycDetails: Map<string, KycDetail>
let kycReviews: Map<string, KycReviewLog[]>
;({ details: kycDetails, reviews: kycReviews } = createMockKycDetailState(kycList))

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

export function resetMockData() {
  oncallStore = createInitialOncallContacts()
  customerStore = createMockCustomerList()
  staffStore = createMockStaffList()
  ;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
  rateHistory = createInitialRateHistory(staffStore[0]?.id ?? 'seed')
  feeHistory = createInitialFeeHistory(staffStore[0]?.id ?? 'seed')
  reserveLedger = createInitialLedgerEntries()
  attestations = createInitialAttestations()
  ledgerIdempotency.clear()
  issuedUploadTickets.clear()
  storageObjects.clear()
  ;({ list: requestList, details: requestDetails } = createMockRequests(customerStore, staffStore))
  ;({ list: orderList, details: orderDetails } = createMockOrders(customerStore))
  kycList = createMockKycList()
  ;({ details: kycDetails, reviews: kycReviews } = createMockKycDetailState(kycList))
  pendingTimers.forEach(clearTimeout)
  pendingTimers.clear()
}

// USDX-84 — test helper. The seeded `createMockRequests` factory generates
// multiple PENDING_APPROVAL/APPROVED entries per Safe (legacy demo data
// useful for list/dashboard tests). That collides with the SoT § Safe
// Propose Queue 1-pending-per-Safe invariant the POST handlers now enforce,
// so submission tests need a clean queue before exercising the happy path.
//
// Not exported from the runtime API surface (no callers in src/, only tests).
export function clearActiveRequestsForTests() {
  for (const item of requestList) {
    if (item.status === 'PENDING_APPROVAL' || item.status === 'APPROVED') {
      requestDetails.delete(item.id)
    }
  }
  requestList = requestList.filter(
    (r) => r.status !== 'PENDING_APPROVAL' && r.status !== 'APPROVED'
  )
}

// Exposed for AuthProvider: looks up Staff without going over HTTP
export function findStaffByEmail(email: string): Staff | undefined {
  const needle = email.trim().toLowerCase()
  return staffStore.find((s) => s.email.toLowerCase() === needle)
}

export function findStaffById(id: string): Staff | undefined {
  return staffStore.find((s) => s.id === id)
}

export function getDefaultStaff(): Staff | undefined {
  return staffStore[0]
}

// HMR safety — clear orphan timers when the module is replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    pendingTimers.forEach(clearTimeout)
    pendingTimers.clear()
  })
}

// ─── Settlement simulator (inline) ───

function settleAfterDelay(
  store: Array<OtcMintTransaction | OtcRedeemTransaction>,
  txId: string
) {
  const delay = 8000 + Math.random() * 7000
  const timer = setTimeout(() => {
    pendingTimers.delete(timer)
    try {
      const tx = store.find((t) => t.id === txId)
      if (!tx || tx.status !== 'pending') return
      const outcome: OtcStatus = Math.random() < 0.9 ? 'completed' : 'failed'
      tx.status = outcome
      tx.settledAt = new Date().toISOString()
    } catch (err) {
      console.warn('[msw] settlement callback failed', err)
    }
  }, delay)
  pendingTimers.add(timer)
}

/** Test hook — synchronously transitions a pending tx to a terminal state. */
export function flushSettlement(txId: string, outcome: 'completed' | 'failed' = 'completed') {
  const all = [...otcMintStore, ...otcRedeemStore]
  const tx = all.find((t) => t.id === txId)
  if (!tx || tx.status !== 'pending') return
  tx.status = outcome
  tx.settledAt = new Date().toISOString()
}

/**
 * Test hook — simulate Safe UI sign + execute by transitioning a
 * Phase-1 request from PENDING_APPROVAL → EXECUTED. The Notifications
 * list filters on `status === 'PENDING_APPROVAL'`, so executed rows
 * disappear automatically once the polling refetch lands.
 */
export function flushApproval(
  requestId: string,
  outcome: 'EXECUTED' | 'REJECTED' = 'EXECUTED'
) {
  const list = requestList.find((r) => r.id === requestId)
  const detail = requestDetails.get(requestId)
  if (!list || !detail || list.status !== 'PENDING_APPROVAL') return
  list.status = outcome
  detail.status = outcome
  detail.updatedAt = new Date().toISOString()
}

// Browser dev hook for the E2E smoke spec
if (typeof window !== 'undefined') {
  ;(window as unknown as { __mswFlushSettlement?: typeof flushSettlement }).__mswFlushSettlement =
    flushSettlement
  ;(window as unknown as { __mswFlushApproval?: typeof flushApproval }).__mswFlushApproval =
    flushApproval
}

// ─── Helpers ───

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  const data = items.slice(start, start + pageSize)
  return {
    data,
    meta: {
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize) || 1,
    },
  }
}

function badRequest(code: string, message: string, details?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, details } }, { status: 400 })
}

// USDX-155 — phase-one error shapes for the KYC review endpoints
// (sot/api/kyc.yaml § detail/approve/reject error responses).
function kycNotFound() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'NOT_FOUND', message: 'KYC record not found' },
    },
    { status: 404 }
  )
}

function kycForbidden() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'FORBIDDEN', message: 'Developer role cannot approve or reject KYC' },
    },
    { status: 403 }
  )
}

function kycInvalidStatus() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: {
        code: 'INVALID_STATUS',
        message: 'KYC status is not PENDING (it may have been reviewed concurrently)',
      },
    },
    { status: 409 }
  )
}

// Asia/Jakarta (UTC+7) date bucket of an ISO timestamp, mirrors BE
// `(col AT TIME ZONE 'Asia/Jakarta')::date`. Inclusive both bounds
// (equivalent to col < endDate + 1 day). Shared by the requests (USDX-98)
// and KYC (USDX-154) list handlers.
function jakartaDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

// ─── Mock JWT (mock-only; v1 risk R64 — not a real signed token) ───
function base64UrlEncode(payload: object): string {
  const json = JSON.stringify(payload)
  // btoa is available in browser + jsdom; encodeURIComponent guards against unicode
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function issueMockJwt(staff: Staff): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const body = base64UrlEncode({
    sub: staff.id,
    email: staff.email,
    role: staff.role,
    iat: now,
    exp: now + 60 * 60 * 24 * 30, // 30 days — matches "Remember this device for 30 days"
  })
  return `${header}.${body}.mock-signature`
}

function base64UrlDecode(segment: string): string {
  const pad = segment.length % 4 === 0 ? 0 : 4 - (segment.length % 4)
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  return decodeURIComponent(escape(atob(b64)))
}

interface MockJwtClaims {
  sub: string
  email: string
  role: string
  iat: number
  exp: number
}

export function verifyMockJwt(token: string): MockJwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  if (parts[2] !== 'mock-signature') return null
  try {
    const claims = JSON.parse(base64UrlDecode(parts[1])) as MockJwtClaims
    if (typeof claims.exp !== 'number') return null
    if (Math.floor(Date.now() / 1000) >= claims.exp) return null
    if (typeof claims.sub !== 'string' || !claims.sub) return null
    return claims
  } catch {
    return null
  }
}

function unauthorized(message = 'Invalid or missing token') {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'UNAUTHORIZED', message },
    },
    { status: 401 }
  )
}

// sot/openapi.yaml § ErrorResponse declares only `error: { code, message }`.
function phaseOneBadRequest(message: string, code = 'VALIDATION_ERROR') {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code, message },
    },
    { status: 400 }
  )
}

// USDX-392: session cookie name set by POST /auth/login (mirrors the live BE).
const SESSION_COOKIE = 'usdx_session'

function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? ''
  const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function authenticatedStaff(request: Request): Staff | null {
  // USDX-392: primary auth is the httpOnly session cookie (credentials:'include'
  // sends it on every request). The Bearer path is kept for backward-compat and
  // for tests that hit the mock directly with an Authorization header.
  const token =
    readSessionCookie(request) ??
    (() => {
      const header = request.headers.get('Authorization') ?? ''
      return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
    })()
  if (!token) return null
  const claims = verifyMockJwt(token)
  if (!claims) return null
  return findStaffById(claims.sub) ?? null
}

// ─── Transparency error envelopes (/api/v1/transparency/*) ───
// Codes + HTTP statuses come straight from the validation tables in
// catatan/KONTRAK-API-TRANSPARANSI.md § 3.
function transparencyError(status: number, code: string, message: string) {
  return HttpResponse.json(
    { status: 'error', metadata: null, data: null, error: { code, message } },
    { status }
  )
}

function transparencyForbidden() {
  return transparencyError(403, 'FORBIDDEN', 'Only ADMIN can write transparency data')
}

/**
 * A DTO/ValidationPipe rejection — a PLAIN 400, not a named 422.
 *
 * `V1_VALIDATION_422_ROUTES` in the backend's http-exception filter lists only
 * `/api/v1/fee-config`, so where a transparency DTO does use class-validator its
 * shape errors come back as NestJS's own 400. That is the ATTESTATION routes:
 * `CreateAttestationUploadUrlDto` and friends carry `@IsString()`/`@IsInt()`, so
 * a missing `period` or `sizeBytes` never reaches the service. A mock that
 * answers a friendly 422 there trains the client to expect a code production
 * cannot send.
 *
 * The LEDGER route is the opposite case and must not be lumped in with it:
 * `CreateLedgerEntryDto` is `@Allow()`-only by design, so every condition —
 * including a missing or mistyped field — exits the service as its own named
 * 422. The only 400 left there is a body that is not JSON at all.
 */
function nestValidationError(messages: string[]) {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'BAD_REQUEST', message: messages.join(', ') },
    },
    { status: 400 }
  )
}

/** numeric(30,2) → at most 28 digits before the decimal point. */
const LEDGER_MAX_INT_DIGITS = 28
/** Shared 5 MiB ceiling — the same number the presigner signs against. */
const ATTESTATION_MAX_FILE_BYTES_MOCK = 5 * 1024 * 1024
/** Every `fileKey` the backend hands out starts here. */
const ATTESTATION_FILE_KEY_PREFIX = 'transparency/attestation/'
/**
 * Backend default when a client omits `take` — matches the number of reports
 * the public page lists. Still small enough that a back office relying on it
 * would lose sight of older reports, which is why the client asks explicitly.
 */
const ATTESTATION_DEFAULT_TAKE = 24
/** `idempotencyKey` bounds the backend enforces (§ 3). */
const LEDGER_IDEMPOTENCY_KEY_MIN = 16
const LEDGER_IDEMPOTENCY_KEY_MAX = 200

// Reserve balance = SUM(amount) over the WHOLE ledger (§ 1). Computed on
// integer cents so a 30-digit numeric never touches a float.
function ledgerBalanceAmount(entries: ReserveLedgerEntry[]): string {
  let cents = 0n
  for (const entry of entries) {
    const [whole = '0', fraction = ''] = entry.amount.replace('-', '').split('.')
    const magnitude = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
    cents += entry.amount.startsWith('-') ? -magnitude : magnitude
  }
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  return `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`
}

// Mirror of the backend's WIB day rule (§ 3): "today" is UTC+7, so an entry
// filed at 02:00 WIB is not treated as tomorrow.
function wibTodayMock(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// A real calendar date? `new Date(2026, 1, 31)` silently rolls over to Mar 3,
// which is why the contract gives this its own code (LEDGER_DATE_INVALID).
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

// Presigned-upload bookkeeping for the fake storage host: upload URL → what
// that URL was signed with.
//
// `contentLength` is in here because the presigner signs `content-length` and
// does NOT sign `content-type` (the AWS SDK marks it unsignable). The browser
// fills Content-Length from the real file and an application cannot override it,
// so the ONLY way the signature can ever match is if step 1 was told the true
// size. A stub that ignores length is why the missing `sizeBytes` looked fine
// locally while every production upload would have been 403'd.
interface IssuedUploadTicket {
  headers: Record<string, string>
  contentLength: number
  fileKey: string
}

const issuedUploadTickets = new Map<string, IssuedUploadTicket>()

/**
 * The fake bucket's contents: fileKey → what actually landed there.
 *
 * Step 3 consults this the way the backend consults S3 before registering a
 * report. Without it the mock would happily register a `fileKey` whose object
 * was never uploaded — publishing a row whose public download is a dead link —
 * and the two codes that exist for exactly that (ATTESTATION_FILE_NOT_UPLOADED,
 * ATTESTATION_FILE_TYPE_INVALID) could never be produced locally.
 */
interface StoredObject {
  size: number
  isPdf: boolean
}

const storageObjects = new Map<string, StoredObject>()

/**
 * Idempotency ledger for POST /transparency/ledger: key → what was written under
 * it. The backend keeps a unique index on the column; a repeat returns the row
 * that already exists instead of appending a second one.
 *
 * The CONTENT is kept, not just the key, because a repeat is only a replay if
 * the request is the same request. Same key + different content is a 409
 * (§ 3) — the case where a 504 is followed by the operator fixing a typo, and a
 * mock that compares keys alone answers it "200, here is your old entry" and
 * hides the exact bug the 409 exists to expose.
 *
 * `createdBy` rides along because the backend compares it too: keys are not
 * scoped per staff member, so a key reused across sessions would otherwise hand
 * staff B the entry staff A wrote, with B's entry never stored.
 */
interface LedgerIdempotencyRecord {
  entry: ReserveLedgerEntry
  createdBy: string
}

const ledgerIdempotency = new Map<string, LedgerIdempotencyRecord>()

/**
 * Decimal money in the canonical `[-]<int>.<2 digits>` form — the form a
 * `numeric(30,2)` column hands back.
 *
 * Used for BOTH storage and comparison, mirroring the backend: the column
 * normalises what it stores, so "100667.4" is read back as "100667.40" and the
 * two must not register as a content conflict. Done on strings, never through
 * `Number()`, because a reserve figure can outrun float64 precision.
 */
function canonicalMoneyMock(value: string): string {
  const trimmed = value.trim()
  const negative = trimmed.startsWith('-')
  const [intRaw = '', fracRaw = ''] = trimmed.replace(/^[-+]/, '').split('.')
  const int = intRaw.replace(/^0+(?=\d)/, '') || '0'
  const canonical = `${int}.${`${fracRaw}00`.slice(0, 2)}`
  // "-0.00" and "0.00" are the same number; the sign only means something once
  // a non-zero digit is present.
  return negative && /[1-9]/.test(canonical) ? `-${canonical}` : canonical
}

// Storage rejects a signature mismatch with 403 and an XML body — deliberately
// NOT the USDX JSON envelope, because this host is not the USDX API.
function storageSignatureError(detail: string) {
  return new HttpResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Error><Code>SignatureDoesNotMatch</Code><Message>${detail}</Message></Error>`,
    { status: 403, headers: { 'Content-Type': 'application/xml' } }
  )
}

// ─── Handlers ───

function oncallForbidden() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'FORBIDDEN', message: 'Only ADMIN can manage on-call contacts' },
    },
    { status: 403 }
  )
}

function oncallNotFound() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'ONCALL_CONTACT_NOT_FOUND', message: 'On-call contact not found' },
    },
    { status: 404 }
  )
}

function oncallDuplicate(
  channel: string,
  contactValue: string,
  ignoreId: string | null
) {
  const clash = oncallStore.some(
    (c) => c.id !== ignoreId && c.channel === channel && c.contactValue === contactValue
  )
  if (!clash) return null
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: {
        code: 'ONCALL_CONTACT_ALREADY_EXISTS',
        message: 'A contact with this channel and value is already registered.',
      },
    },
    { status: 409 }
  )
}

function oncallBodyError(body: Partial<CreateOncallContact>) {
  const problems: string[] = []
  if (!body.name?.trim()) problems.push('name')
  if (!body.role?.trim()) problems.push('role')
  if (!body.channel) problems.push('channel')
  if (!body.contactValue?.trim()) problems.push('contactValue')
  if (!body.categories || body.categories.length === 0) problems.push('categories')
  if (problems.length === 0) return null
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Required and must be non-empty: ${problems.join(', ')}`,
      },
    },
    { status: 422 }
  )
}

export const handlers = [
  // ─── Kontak on-call insiden uang (USDX-485, audit alur uang P1-18) ───
  //
  // Backend menyimpan daftar ini dan menyisipkan kontak yang cocok kategorinya ke
  // dalam isi alarm kondisi uang. SELURUH permukaannya — termasuk BACA — admin-only:
  // `contactValue` bisa berupa nomor telepon (PII → ADMIN saja per tabel role di
  // sot/conventions.md § Audit Akses PII), dan daftar "siapa yang boleh menarik rem
  // darurat payout" bukan pengetahuan yang perlu dibagikan lebih luas.
  //
  // Mock-served (tidak masuk INTEGRATION_PATHS di browser.ts) — endpoint BE-nya baru
  // mendarat di PR backend yang menyertai tiket ini dan belum tentu sudah ter-deploy
  // di dev saat halaman ini dipakai.
  http.get('/api/v1/oncall-contacts', ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageOncallContacts(operator.role)) return oncallForbidden()
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: [...oncallStore].sort((a, b) => a.name.localeCompare(b.name)),
    })
  }),

  http.post('/api/v1/oncall-contacts', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageOncallContacts(operator.role)) return oncallForbidden()

    const body = (await request.json()) as CreateOncallContact
    const invalid = oncallBodyError(body)
    if (invalid) return invalid
    const duplicate = oncallDuplicate(body.channel, body.contactValue, null)
    if (duplicate) return duplicate

    const created = createOncallContact({ ...body, createdBy: operator.id })
    oncallStore.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  http.patch('/api/v1/oncall-contacts/:id', async ({ request, params }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageOncallContacts(operator.role)) return oncallForbidden()

    const index = oncallStore.findIndex((c) => c.id === params.id)
    if (index === -1) return oncallNotFound()

    const existing = oncallStore[index]!
    const body = (await request.json()) as UpdateOncallContact
    const next = { ...existing, ...body }
    const invalid = oncallBodyError(next)
    if (invalid) return invalid
    const duplicate = oncallDuplicate(next.channel, next.contactValue, existing.id)
    if (duplicate) return duplicate

    const updated: OncallContact = {
      ...next,
      categories: [...next.categories],
      updatedBy: operator.id,
      updatedAt: new Date().toISOString(),
    }
    oncallStore[index] = updated
    return HttpResponse.json({ status: 'success', metadata: null, data: updated })
  }),

  http.delete('/api/v1/oncall-contacts/:id', ({ request, params }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageOncallContacts(operator.role)) return oncallForbidden()

    const index = oncallStore.findIndex((c) => c.id === params.id)
    if (index === -1) return oncallNotFound()
    oncallStore.splice(index, 1)
    return HttpResponse.json({ status: 'success', metadata: null, data: null })
  }),

  // ─── Auth ───
  // Response envelope follows sot/openapi.yaml § /api/v1/auth/login.
  http.post('/api/v1/auth/login', async ({ request }) => {
    let body: { email?: string; password?: string }
    try {
      body = (await request.json()) as { email?: string; password?: string }
    } catch {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON' },
        },
        { status: 400 }
      )
    }
    const email = body.email?.trim() ?? ''
    const password = body.password ?? ''
    if (!email || !password) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        },
        { status: 401 }
      )
    }
    // R64 (mock-only): any non-empty credential pair authenticates.
    const matched = findStaffByEmail(email) ?? getDefaultStaff()
    if (!matched) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        },
        { status: 401 }
      )
    }
    // USDX-392: set the httpOnly session cookie (primary auth) and still return
    // `accessToken` in the body for backward-compat. Max-Age 28800s = 8h, the
    // cap the live backend enforces (PR #197).
    const token = issueMockJwt(matched)
    return HttpResponse.json(
      {
        status: 'success',
        metadata: null,
        data: {
          accessToken: token,
          staff: matched,
        },
      },
      {
        headers: {
          'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
        },
      }
    )
  }),

  // USDX-392 — sot/openapi.yaml § /api/v1/auth/logout: revoke the session
  // server-side and clear the cookie. Auth is via the session cookie.
  http.post('/api/v1/auth/logout', ({ request }) => {
    // A logout without a session is a no-op success (idempotent).
    authenticatedStaff(request)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: null },
      {
        headers: {
          'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
        },
      }
    )
  }),

  // sot/openapi.yaml § /api/v1/auth/me — restore session by the session cookie
  // (Bearer still accepted for backward-compat / direct-fetch tests).
  http.get('/api/v1/auth/me', ({ request }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: staff,
    })
  }),

  // USDX-23: /api/customers/* handlers removed — legacy mock domain replaced
  // by the SoT `/api/v1/users` flow (USDX-37 + USDX-47). No remaining consumer.
  //
  // USDX-41: /api/staff/* mock removed — StaffPage now hits real GET /api/v1/staff.

  // ─── OTC Mint ───
  http.get('/api/otc/mint', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const operatorStaffId = url.searchParams.get('operatorStaffId')

    let result = [...otcMintStore].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    if (operatorStaffId) result = result.filter((t) => t.operatorStaffId === operatorStaffId)

    return HttpResponse.json(paginate(result, page, pageSize))
  }),

  http.post('/api/otc/mint', async ({ request }) => {
    const body = (await request.json()) as Partial<OtcMintTransaction> & {
      customerId: string
      operatorStaffId: string
    }
    const customer = customerStore.find((c) => c.id === body.customerId)
    const operator = staffStore.find((s) => s.id === body.operatorStaffId)
    if (!customer) return badRequest('VALIDATION', 'Customer not found')
    if (!operator) return badRequest('VALIDATION', 'Operator not found')

    const created = createOtcMintTransaction(customer, operator, {
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
      settledAt: undefined,
    })
    otcMintStore.unshift(created)
    settleAfterDelay(otcMintStore, created.id)
    return HttpResponse.json(created, { status: 201 })
  }),

  // ─── OTC Redeem ───
  http.get('/api/otc/redeem', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const operatorStaffId = url.searchParams.get('operatorStaffId')

    let result = [...otcRedeemStore].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    if (operatorStaffId) result = result.filter((t) => t.operatorStaffId === operatorStaffId)

    return HttpResponse.json(paginate(result, page, pageSize))
  }),

  http.post('/api/otc/redeem', async ({ request }) => {
    const body = (await request.json()) as Partial<OtcRedeemTransaction> & {
      customerId: string
      operatorStaffId: string
    }
    const customer = customerStore.find((c) => c.id === body.customerId)
    const operator = staffStore.find((s) => s.id === body.operatorStaffId)
    if (!customer) return badRequest('VALIDATION', 'Customer not found')
    if (!operator) return badRequest('VALIDATION', 'Operator not found')

    const created = createOtcRedeemTransaction(customer, operator, {
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
      settledAt: undefined,
    })
    otcRedeemStore.unshift(created)
    settleAfterDelay(otcRedeemStore, created.id)
    return HttpResponse.json(created, { status: 201 })
  }),

  // USDX-37: /api/dashboard/snapshot mock removed — superseded by SoT
  // /api/v1/dashboard/stats (real BE per mocks/browser.ts § INTEGRATION_PATHS;
  // tests still hit the in-process /api/v1/dashboard/stats handler below).

  // USDX-42: /report mock removed — superseded by /requests.

  // USDX-41: /api/profile/:id mock removed — ProfilePage uses useAuth().user
  // (sourced from real GET /api/v1/auth/me).

  // ─── Rate (sot/openapi.yaml § /api/v1/rate) ───
  // GET is intentionally not Bearer-gated in the mock: the production endpoint
  // requires auth, but enforcing it here would 401 React Query's first fetch
  // when child-component effects fire before AuthProvider has wired apiFetch
  // bindings. Real backend reads JWT and returns 401 — UI handles that path
  // already via apiFetch.onUnauthorized.
  http.get('/api/v1/rate', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: computeRateInfo(rateHistory),
    })
  ),

  http.post('/api/v1/rate', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageRate(operator.role)) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Only ADMIN can update rate' },
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as UpdateRateConfig

    function rateBadRequest(message: string) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'VALIDATION', message },
        },
        { status: 400 }
      )
    }

    if (body.mode !== 'MANUAL' && body.mode !== 'DYNAMIC') {
      return rateBadRequest('mode must be MANUAL or DYNAMIC')
    }
    if (body.mode === 'MANUAL') {
      const n = Number(body.manualRate)
      if (!body.manualRate || !Number.isFinite(n) || n <= 0) {
        return rateBadRequest('manualRate is required when mode is MANUAL')
      }
    }
    for (const key of ['spreadBuyPct', 'spreadSellPct'] as const) {
      const raw = body[key]
      if (raw != null) {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0) {
          return rateBadRequest(`${key} must be a non-negative number`)
        }
      }
    }

    const created = createRateConfig({
      mode: body.mode as RateMode,
      manualRate: body.mode === 'MANUAL' ? (body.manualRate ?? null) : null,
      spreadBuyPct: body.spreadBuyPct ?? '0',
      spreadSellPct: body.spreadSellPct ?? '0',
      updatedBy: operator.id,
      createdAt: new Date().toISOString(),
    })
    rateHistory.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // ─── Fee config (sot/api/fee.yaml § /api/v1/fee-config, USDX-207) ───
  // GET = semua role backoffice (read); POST = admin only (append-only).
  // Mock-served (not in browser INTEGRATION_PATHS) — BE belum tentu live.
  // GET not Bearer-gated, same rationale as /api/v1/rate above.
  http.get('/api/v1/fee-config', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: feeHistory[feeHistory.length - 1],
    })
  ),

  http.post('/api/v1/fee-config', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageFeeConfig(operator.role)) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Only ADMIN can update fee config' },
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as UpdateFeeConfig

    // sot/conventions.md § Validation Error — fee-config is on the v1→422
    // allowlist, so body failures use 422 VALIDATION_ERROR (not 400/VALIDATION).
    function feeValidationError(message: string) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'VALIDATION_ERROR', message },
        },
        { status: 422 }
      )
    }

    // POST = full 5-field snapshot; every field required + non-negative (W3
    // redeem fields included so partial submits can't zero them out, USDX-245).
    for (const key of [
      'mintFeePct',
      'pgFeeVaFlat',
      'pgFeeQrisPct',
      'redeemFeePct',
      'disbursementFeeFlat',
    ] as const) {
      const raw = body[key]
      const n = Number(raw)
      if (raw == null || raw === '' || !Number.isFinite(n) || n < 0) {
        return feeValidationError(`${key} is required and must be a non-negative number`)
      }
    }

    const created = createFeeConfig({
      mintFeePct: body.mintFeePct,
      pgFeeVaFlat: body.pgFeeVaFlat,
      pgFeeQrisPct: body.pgFeeQrisPct,
      redeemFeePct: body.redeemFeePct,
      disbursementFeeFlat: body.disbursementFeeFlat,
      updatedBy: operator.id,
      createdAt: new Date().toISOString(),
    })
    feeHistory.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // ─── Transparency (/api/v1/transparency/*) ───
  // APPEND-ONLY reserve ledger + attestation reports, per
  // catatan/KONTRAK-API-TRANSPARANSI.md § 3. There is no update, no delete and
  // no draft/publish state — a correction is a new entry with a negative
  // amount. Writes are ADMIN-only; reads are open here for the same
  // first-fetch-ordering reason as /api/v1/rate above (the route-level
  // RoleGuard is what gates reading in the app).
  //
  // NOT in browser.ts INTEGRATION_PATHS yet — the backend is still being built.

  http.get('/api/v1/transparency/ledger', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const take = Math.max(1, Number(url.searchParams.get('take') ?? '50') || 50)

    // Newest event first, then newest record — the order an operator reads a
    // ledger in.
    const ordered = [...reserveLedger].sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) ||
        b.createdAt.localeCompare(a.createdAt)
    )
    const start = (page - 1) * take

    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: {
        entries: ordered.slice(start, start + take),
        page,
        take,
        total: ordered.length,
        // Balance of the ENTIRE ledger, not of this page.
        balance: {
          amount: ledgerBalanceAmount(reserveLedger),
          currency: 'USD',
        },
      },
    })
  }),

  http.post('/api/v1/transparency/ledger', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageTransparency(operator.role)) return transparencyForbidden()

    // Every field arrives as `unknown`, exactly as the backend sees it. Its DTO
    // is `@Allow()` and nothing else — no `@IsString`, no `@Matches` — precisely
    // so ValidationPipe never answers for this route and each condition can come
    // back as its OWN named 422 (`ledger-entry.validation.ts`). A JSON number in
    // `amount` is therefore 422 LEDGER_AMOUNT_INVALID, not a 400 and certainly
    // not the 500 this mock used to raise on `amount.replace`.
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      // The one 400 this route can still produce: a body the JSON parser cannot
      // read at all, rejected before Nest ever reaches the controller.
      return nestValidationError(['Unexpected token in JSON at position 0'])
    }

    // Order and codes follow `validateLedgerEntryInput` exactly — entryType,
    // amount, reason, occurredAt, currency, idempotencyKey — because the order
    // decides WHICH code a doubly-invalid body gets back.
    const entryType = body.entryType
    if (entryType !== 'SEED' && entryType !== 'ADJUSTMENT') {
      return transparencyError(
        422,
        'LEDGER_TYPE_NOT_ALLOWED',
        'entryType must be SEED or ADJUSTMENT'
      )
    }

    // Money is a STRING in this contract. A JSON number is a float64 — the type
    // the whole contract keeps money away from — and `regex.test(1000)` would
    // silently coerce it and let it through.
    // NOT trimmed either: the backend does not trim `amount`, so " 100.00 "
    // fails its decimal check, and a mock that trims makes surrounding
    // whitespace look harmless.
    const amount = body.amount
    if (typeof amount !== 'string' || !/^-?\d+(\.\d{1,2})?$/.test(amount)) {
      return transparencyError(
        422,
        'LEDGER_AMOUNT_INVALID',
        'amount must be a decimal string with at most 2 decimal places'
      )
    }
    // numeric(30,2) — Postgres refuses a wider value outright. Counted the way
    // the backend counts, WITHOUT stripping leading zeros: it measures the
    // digits it was sent, so "0…0" padding is rejected there too.
    const [wholePart = ''] = amount.replace('-', '').split('.')
    if (wholePart.length > LEDGER_MAX_INT_DIGITS) {
      return transparencyError(
        422,
        'LEDGER_AMOUNT_INVALID',
        `amount cannot have more than ${LEDGER_MAX_INT_DIGITS} digits before the decimal point`
      )
    }
    // "0", "0.00" and "-0.00" are all zero. Matched on the string rather than
    // through `Number()`, which would round a 28-digit value on the way.
    if (/^-?0(\.0{1,2})?$/.test(amount)) {
      return transparencyError(422, 'LEDGER_AMOUNT_ZERO', 'amount cannot be zero')
    }

    // A non-string `reason` is not "missing": `.trim()` on a number is a
    // TypeError, which would be a 500 where the backend answers 422.
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 10) {
      return transparencyError(
        422,
        'LEDGER_REASON_TOO_SHORT',
        'reason must be at least 10 characters'
      )
    }

    const occurredAt = body.occurredAt
    if (
      typeof occurredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt) ||
      !isRealCalendarDate(occurredAt)
    ) {
      return transparencyError(
        422,
        'LEDGER_DATE_INVALID',
        'occurredAt must be a real YYYY-MM-DD date'
      )
    }
    if (occurredAt > wibTodayMock()) {
      return transparencyError(
        422,
        'LEDGER_DATE_IN_FUTURE',
        'occurredAt cannot be in the future'
      )
    }

    // Case-insensitive, then stored uppercase — the backend normalises with
    // `toUpperCase()` before comparing.
    const currency = body.currency
    if (typeof currency !== 'string' || currency.toUpperCase() !== 'USD') {
      return transparencyError(
        422,
        'LEDGER_CURRENCY_UNSUPPORTED',
        'Only USD is supported at this stage'
      )
    }

    // Trimmed before the length check, and the trimmed value is what gets
    // stored and looked up — same as the backend. The 16-character floor is the
    // important half: a throwaway key like "retry" would collide between
    // unrelated attempts, and a collision answers the second one with the first
    // one's entry, silently losing a legitimate ledger row.
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    if (
      idempotencyKey.length < LEDGER_IDEMPOTENCY_KEY_MIN ||
      idempotencyKey.length > LEDGER_IDEMPOTENCY_KEY_MAX
    ) {
      return transparencyError(
        422,
        'LEDGER_IDEMPOTENCY_KEY_INVALID',
        `idempotencyKey is required, ${LEDGER_IDEMPOTENCY_KEY_MIN}–${LEDGER_IDEMPOTENCY_KEY_MAX} characters`
      )
    }

    const canonicalAmount = canonicalMoneyMock(amount)
    const normalisedCurrency = currency.toUpperCase()

    // A key already on file answers ONE of two ways, and telling them apart is
    // the whole job:
    //   same content  → replay. The first attempt wrote the row and lost its
    //                   response, so hand back that row. 200, not 201 — nothing
    //                   was created this time.
    //   different     → 409, and nothing is written. Not a retry of that entry:
    //                   the operator corrected something (the typo'd amount,
    //                   most likely) after a timeout, and answering "success"
    //                   with the OLD entry leaves the wrong figure standing on
    //                   the public site with nothing on screen to say so.
    // Amounts compare in canonical form because the column stores them that way
    // — "100667.4" and "100667.40" are the same money, not a conflict.
    const previous = ledgerIdempotency.get(idempotencyKey)
    if (previous) {
      const sameRequest =
        previous.entry.entryType === entryType &&
        canonicalMoneyMock(previous.entry.amount) === canonicalAmount &&
        previous.entry.currency === normalisedCurrency &&
        previous.entry.reason === reason &&
        previous.entry.occurredAt === occurredAt &&
        // Keys are not scoped per staff member. Without this, staff B reusing
        // A's key is handed A's entry and B's own entry is never written.
        previous.createdBy === operator.id
      if (!sameRequest) {
        return transparencyError(
          409,
          'LEDGER_IDEMPOTENCY_KEY_CONFLICT',
          'This idempotencyKey is already used by an entry with DIFFERENT content. The existing entry was left untouched and nothing new was written — reload the balance and history, then re-send with a new key if this really is a different entry.'
        )
      }
      return HttpResponse.json(
        { status: 'success', metadata: null, data: previous.entry },
        { status: 200 }
      )
    }

    const created = createLedgerEntry({
      entryType,
      // Stored canonical, the way numeric(30,2) stores it.
      amount: canonicalAmount,
      currency: normalisedCurrency,
      reason,
      occurredAt,
      createdByName: operator.name,
      createdAt: new Date().toISOString(),
    })
    reserveLedger.push(created)
    ledgerIdempotency.set(idempotencyKey, { entry: created, createdBy: operator.id })
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // Attestations — three-step upload (§ 3). Step 1 hands out a presigned URL.
  //
  // BOTH `period` and `sizeBytes` are REQUIRED, and each is required for its own
  // reason:
  //   `period`    — the backend derives `fileKey` from it.
  //   `sizeBytes` — the presigner signs `content-length` with it. Absent, the
  //                 backend signs a fixed length, the browser sends the real
  //                 one, and storage 403s every upload.
  // Missing either is a DTO failure, so the answer is a plain 400 and not a
  // named 422 — transparency is not in V1_VALIDATION_422_ROUTES. The previous
  // version of this mock replied 422 INVALID_ATTESTATION_PERIOD to a bodyless
  // request, which is a code the real backend cannot produce for that case.
  http.post('/api/v1/transparency/attestations/upload-url', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageTransparency(operator.role)) return transparencyForbidden()

    let body: { period?: unknown; sizeBytes?: unknown } | null = null
    try {
      body = (await request.json()) as { period?: unknown; sizeBytes?: unknown }
    } catch {
      body = null
    }

    const dtoErrors: string[] = []
    if (typeof body?.period !== 'string' || body.period.trim() === '') {
      dtoErrors.push('period should not be empty')
    }
    if (
      typeof body?.sizeBytes !== 'number' ||
      !Number.isInteger(body.sizeBytes) ||
      body.sizeBytes <= 0
    ) {
      dtoErrors.push('sizeBytes must be a positive integer')
    }
    if (dtoErrors.length > 0) return nestValidationError(dtoErrors)

    const period = (body!.period as string).trim()
    const sizeBytes = body!.sizeBytes as number

    // Service-level checks DO carry named codes (assertValidPeriod's pattern).
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      return transparencyError(
        422,
        'INVALID_ATTESTATION_PERIOD',
        'period must be a YYYY-MM value'
      )
    }
    if (sizeBytes > ATTESTATION_MAX_FILE_BYTES_MOCK) {
      return transparencyError(
        422,
        'ATTESTATION_FILE_TOO_LARGE',
        `File must be at most ${ATTESTATION_MAX_FILE_BYTES_MOCK} bytes`
      )
    }

    // The backend builds the key from `period` — mirror that so the fileKey the
    // client registers in step 3 is traceable to the month it covers.
    const fileKey = `${ATTESTATION_FILE_KEY_PREFIX}${period}-report.pdf`
    const uploadUrl = `https://storage.usdx.test/upload/${encodeURIComponent(fileKey)}`
    const headers = { 'content-type': 'application/pdf' }

    // Remember what this URL was "signed" with — headers AND length — so the PUT
    // handler below can reject a mismatch the way real storage would.
    issuedUploadTickets.set(uploadUrl, {
      headers,
      contentLength: sizeBytes,
      fileKey,
    })

    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: {
        uploadUrl,
        fileKey,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        headers,
      },
    })
  }),

  // Step 2 — the client PUTs the bytes straight at the storage host. This
  // handler stands in for that bucket; it is NOT part of the USDX API, which is
  // exactly why the app must not send session cookies to it.
  //
  // It VERIFIES the signed headers. Real presigned URLs are signed together with
  // a specific header set and answer a mismatch with SignatureDoesNotMatch. A
  // mock that accepts any PUT would let a client hardcode its own headers, pass
  // every test, and fail only in production — the same trap as the missing
  // `period`.
  http.put('https://storage.usdx.test/upload/*', async ({ request }) => {
    const ticket = issuedUploadTickets.get(request.url)
    if (!ticket) {
      // No ticket was ever issued for this URL — an unsigned or forged upload.
      return storageSignatureError('No signed ticket was issued for this URL')
    }
    for (const [name, expected] of Object.entries(ticket.headers)) {
      const actual = request.headers.get(name)
      if ((actual ?? '').toLowerCase() !== expected.toLowerCase()) {
        return storageSignatureError(
          `Header "${name}" was signed as "${expected}" but the request sent "${actual ?? '(absent)'}"`
        )
      }
    }
    // Content-Length is part of the signature and the BROWSER owns it: it is a
    // forbidden header, so the client cannot set or fake it, it is simply the
    // real byte count of the file. The signature therefore only matches when
    // step 1 declared that same number as `sizeBytes`.
    const body = await request.arrayBuffer()
    const sent = body.byteLength
    if (sent !== ticket.contentLength) {
      return storageSignatureError(
        `content-length was signed as ${ticket.contentLength} but the request sent ${sent}`
      )
    }

    // The object now exists in the bucket. Step 3 reads this back, the way the
    // backend HEADs/GETs the object before registering a report — which is what
    // makes ATTESTATION_FILE_NOT_UPLOADED and ATTESTATION_FILE_TYPE_INVALID
    // reachable at all.
    const head = String.fromCharCode(...new Uint8Array(body.slice(0, 5)))
    storageObjects.set(ticket.fileKey, { size: sent, isPdf: head === '%PDF-' })
    return new HttpResponse(null, { status: 200 })
  }),

  // The list is PAGED, and `take` defaults to 20 exactly like the backend.
  // A generous default here would hide the bug it is meant to expose: a client
  // that asks for no page size sees 20 rows at most, fewer after revoked ones
  // are filtered out, and silently loses access to everything older.
  http.get('/api/v1/transparency/attestations', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const takeParam = url.searchParams.get('take')
    const take = Math.max(
      1,
      Number(takeParam ?? ATTESTATION_DEFAULT_TAKE) || ATTESTATION_DEFAULT_TAKE
    )
    const ordered = [...attestations].sort((a, b) => b.period.localeCompare(a.period))
    const start = (page - 1) * take

    return HttpResponse.json({
      status: 'success',
      metadata: null,
      // Revoked rows ARE included — the backend returns everything for the
      // audit trail and the back office is responsible for filtering.
      data: {
        items: ordered.slice(start, start + take),
        page,
        take,
        total: ordered.length,
      },
    })
  }),

  // Step 3 — register the uploaded object. JSON with `fileKey`, never multipart.
  http.post('/api/v1/transparency/attestations', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageTransparency(operator.role)) return transparencyForbidden()

    const body = (await request.json()) as CreateAttestationInput

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.period ?? '')) {
      return transparencyError(
        422,
        'INVALID_ATTESTATION_PERIOD',
        'period must be a YYYY-MM value'
      )
    }
    if (!body.title?.trim() || !body.fileKey?.trim()) {
      return nestValidationError(['title and fileKey should not be empty'])
    }
    // The backend only accepts a key it issued itself in step 1, so an
    // arbitrary string cannot be registered as a published report.
    if (!body.fileKey.startsWith(ATTESTATION_FILE_KEY_PREFIX)) {
      return transparencyError(
        422,
        'INVALID_FILE_KEY',
        `fileKey must start with ${ATTESTATION_FILE_KEY_PREFIX}`
      )
    }
    // Only an ACTIVE report blocks the period — a revoked one may be replaced.
    // Checked before the bucket lookups below: it is the cheap one, and a taken
    // period makes the request dead no matter what the file turns out to be.
    if (attestations.some((a) => a.period === body.period && a.revokedAt === null)) {
      return transparencyError(
        409,
        'ATTESTATION_PERIOD_EXISTS',
        `An active report already exists for ${body.period}`
      )
    }
    // Registering a key whose object never landed would publish a report row
    // whose public download is a dead link. The backend checks the bucket;
    // so does this.
    const stored = storageObjects.get(body.fileKey)
    if (!stored || stored.size === 0) {
      return transparencyError(
        422,
        'ATTESTATION_FILE_NOT_UPLOADED',
        'No object was found at that fileKey — step 2 did not complete'
      )
    }
    // Content type is judged from the BYTES, not from what step 2 claimed in a
    // header. A renamed executable published under "Laporan Atestasi" is worse
    // than a rejected upload.
    if (!stored.isPdf) {
      return transparencyError(
        422,
        'ATTESTATION_FILE_TYPE_INVALID',
        'The uploaded object is not a PDF'
      )
    }

    const created = createAttestationReport({
      period: body.period,
      title: body.title.trim(),
      fileUrl: `https://storage.usdx.test/${body.fileKey}`,
      publishedAt: new Date().toISOString(),
      revokedAt: null,
    })
    attestations.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // Revoke — fills `revokedAt`, never removes the row.
  http.delete('/api/v1/transparency/attestations/:id', ({ request, params }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageTransparency(operator.role)) return transparencyForbidden()

    const report = attestations.find((a) => a.id === params.id)
    // An already-revoked report is a 404, not a second successful revoke. The
    // backend scopes its lookup to active rows, so the row is simply not there
    // to revoke — answering 200 taught the client that a double revoke is fine.
    if (!report || report.revokedAt !== null) {
      return transparencyError(404, 'NOT_FOUND', 'Attestation not found')
    }
    report.revokedAt = new Date().toISOString()
    return HttpResponse.json({ status: 'success', metadata: null, data: report })
  }),

  // ─── Chain config — sot/api/chains.yaml § GET /api/v1/chains ───
  // FE-facing chain metadata (block explorer + Safe addresses) used to build
  // on-chain deep-links. Real-BE-backed in the browser (see browser.ts §
  // INTEGRATION_PATHS); this handler keeps Vitest coverage. Not Bearer-gated in
  // the mock for the same reason as /api/v1/rate above.
  http.get('/api/v1/chains', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: createMockChainConfigs(),
    })
  ),

  // USDX-82: MSW reporting handlers removed — `/api/v1/reports/*` now hits the
  // real BE (sot/api/reporting.yaml). Requests fall through to the configured
  // VITE_API_URL via `onUnhandledRequest: 'bypass'` in main.tsx.

  // ─── Phase 1 Requests (mint/burn approval lifecycle) — see sot/openapi.yaml ───
  // USDX-51: `?search=` filters by user name / address substring (case-insensitive).
  // USDX-78: `?search=` also matches on request `id` (prefix / substring) — users
  // typically paste the short form `019e1aa8` from the ID column. Per
  // sot/api/requests.yaml § search L26-34.
  http.get('/api/v1/requests', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Number(url.searchParams.get('limit') || '10'))
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const chain = url.searchParams.get('chain')
    const safeType = url.searchParams.get('safeType')
    const search = url.searchParams.get('search')?.trim().toLowerCase()
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Mirror backend USDX-98: date-only, reject datetime → 400; cross-field
    // endDate >= startDate only when both present.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (startDate !== null && !DATE_RE.test(startDate))
      return phaseOneBadRequest('startDate must be YYYY-MM-DD')
    if (endDate !== null && !DATE_RE.test(endDate))
      return phaseOneBadRequest('endDate must be YYYY-MM-DD')
    if (startDate && endDate && endDate < startDate)
      return phaseOneBadRequest('endDate must be greater than or equal to startDate')

    let rows = [...requestList]
    if (type === 'mint' || type === 'burn') rows = rows.filter((r) => r.type === type)
    if (status) rows = rows.filter((r) => r.status === status)
    if (chain) rows = rows.filter((r) => r.chain === chain)
    if (safeType === 'STAFF' || safeType === 'MANAGER') {
      rows = rows.filter((r) => r.safeType === safeType)
    }
    if (startDate) rows = rows.filter((r) => jakartaDate(r.createdAt) >= startDate)
    if (endDate) rows = rows.filter((r) => jakartaDate(r.createdAt) <= endDate)
    if (search) {
      rows = rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(search) ||
          r.userAddress.toLowerCase().includes(search) ||
          r.id.toLowerCase().includes(search)
      )
    }

    const start = (page - 1) * limit
    const data = rows.slice(start, start + limit)

    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit, total: rows.length },
      data,
    })
  }),

  // ─── Phase 2 W1 — KYC backoffice list (sot/api/kyc.yaml § list, USDX-154) ───
  // Real BE in the browser (see src/mocks/browser.ts § INTEGRATION_PATHS);
  // this handler keeps Vitest coverage. The contract exposes no sort params —
  // order is fixed at submitted_at ascending (oldest pending first, week1.md
  // § Backoffice Approval Menu).
  http.get('/api/v1/kyc', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Number(url.searchParams.get('limit') || '10'))
    const status = url.searchParams.get('status')
    const entityType = url.searchParams.get('entityType')
    const search = url.searchParams.get('search')?.trim().toLowerCase()
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (startDate !== null && !DATE_RE.test(startDate))
      return phaseOneBadRequest('startDate must be YYYY-MM-DD')
    if (endDate !== null && !DATE_RE.test(endDate))
      return phaseOneBadRequest('endDate must be YYYY-MM-DD')
    if (startDate && endDate && endDate < startDate)
      return phaseOneBadRequest('endDate must be greater than or equal to startDate')

    let rows = [...kycList]
    if (status) rows = rows.filter((r) => r.status === status)
    if (entityType) rows = rows.filter((r) => r.entityType === entityType)
    // Search matches user email only (plaintext in `users`) — kyc.yaml § search.
    if (search) rows = rows.filter((r) => r.userEmail.toLowerCase().includes(search))
    if (startDate)
      rows = rows.filter((r) => r.submittedAt && jakartaDate(r.submittedAt) >= startDate)
    if (endDate)
      rows = rows.filter((r) => r.submittedAt && jakartaDate(r.submittedAt) <= endDate)

    rows.sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))

    const start = (page - 1) * limit
    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit, total: rows.length },
      data: rows.slice(start, start + limit),
    })
  }),

  // ─── USDX-155 — KYC detail / reviews / approve / reject (sot/api/kyc.yaml) ───
  // Real BE in the browser (INTEGRATION_PATHS); handlers kept for Vitest.

  http.get('/api/v1/kyc/:id', ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    const detail = kycDetails.get(String(params.id))
    if (!detail) return kycNotFound()
    // Audit-first (kyc.yaml § detail): a VIEWED row is inserted on EVERY call
    // — Developer included, never debounced. Mirrored here so tests can assert
    // the trail grows when the modal (re)fetches.
    kycReviews.get(detail.id)?.unshift(
      createKycReviewLog({
        action: 'VIEWED',
        actorStaffId: staff.id,
        actorStaffName: staff.name,
        ipAddress: null,
        createdAt: new Date().toISOString(),
      })
    )
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      // Presigned URLs are generated per request — stamp a fresh 5-minute TTL.
      data: { ...detail, urlExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() },
    })
  }),

  http.get('/api/v1/kyc/:id/reviews', ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    const rows = kycReviews.get(String(params.id))
    if (!rows) return kycNotFound()
    // Reverse-chronological; reading the trail does NOT write a VIEWED row
    // (kyc.yaml § reviewsHistory).
    return HttpResponse.json({ status: 'success', metadata: null, data: rows })
  }),

  http.post('/api/v1/kyc/:id/approve', ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    if (staff.role === 'DEVELOPER') return kycForbidden()
    const detail = kycDetails.get(String(params.id))
    if (!detail) return kycNotFound()
    if (detail.status !== 'PENDING') return kycInvalidStatus()
    const now = new Date().toISOString()
    detail.status = 'VERIFIED'
    detail.reviewedBy = staff.id
    detail.reviewedByName = staff.name
    detail.reviewedAt = now
    detail.updatedAt = now
    const listRow = kycList.find((r) => r.id === detail.id)
    if (listRow) {
      listRow.status = 'VERIFIED'
      listRow.reviewedAt = now
      listRow.reviewedByName = staff.name
    }
    kycReviews.get(detail.id)?.unshift(
      createKycReviewLog({
        action: 'APPROVED',
        actorStaffId: staff.id,
        actorStaffName: staff.name,
        ipAddress: null,
        createdAt: now,
      })
    )
    return HttpResponse.json({ status: 'success', metadata: null, data: listRow ?? detail })
  }),

  http.post('/api/v1/kyc/:id/reject', async ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    if (staff.role === 'DEVELOPER') return kycForbidden()
    const detail = kycDetails.get(String(params.id))
    if (!detail) return kycNotFound()
    if (detail.status !== 'PENDING') return kycInvalidStatus()
    let body: { reason?: unknown }
    try {
      body = (await request.json()) as { reason?: unknown }
    } catch {
      return phaseOneBadRequest('Invalid JSON body', 'BAD_REQUEST')
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 1 || reason.length > 500) {
      return phaseOneBadRequest('reason must be 1–500 characters', 'BAD_REQUEST')
    }
    const now = new Date().toISOString()
    detail.status = 'REJECTED'
    detail.rejectionReason = reason
    detail.reviewedBy = staff.id
    detail.reviewedByName = staff.name
    detail.reviewedAt = now
    detail.updatedAt = now
    const listRow = kycList.find((r) => r.id === detail.id)
    if (listRow) {
      listRow.status = 'REJECTED'
      listRow.reviewedAt = now
      listRow.reviewedByName = staff.name
    }
    kycReviews.get(detail.id)?.unshift(
      createKycReviewLog({
        action: 'REJECTED',
        actorStaffId: staff.id,
        actorStaffName: staff.name,
        reason,
        ipAddress: null,
        createdAt: now,
      })
    )
    return HttpResponse.json({ status: 'success', metadata: null, data: listRow ?? detail })
  }),

  // ─── Dashboard stats — sot/openapi.yaml § /api/v1/dashboard/stats ───
  http.get('/api/v1/dashboard/stats', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: computeDashboardStats(requestList),
    })
  ),

  http.get('/api/v1/requests/:id', ({ params }) => {
    const detail = requestDetails.get(String(params.id))
    if (!detail) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ status: 'success', metadata: null, data: detail })
  }),

  // ─── Phase 2 W2 — Consumer Orders / "User Transaction" (USDX-206) ───
  // sot/api/orders.yaml. Read-only monitoring; auth = semua role backoffice.
  // Week 2 is mint-only — `type=REDEEM` is accepted (union-ready) but matches
  // nothing until W3. Not bearer-gated in the mock for the same reason as the
  // `/api/v1/requests` list above (real BE enforces 401; this keeps Vitest +
  // dev simple). Param `take` per orders.yaml (`limit` accepted as a fallback).
  http.get('/api/v1/orders', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const take = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('take') || url.searchParams.get('limit') || '10')),
    )
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    // Redeem orders filter on RedeemStatus via `redeemStatus` (USDX-254). The
    // union `status` field carries the RedeemStatus value for redeem rows, so we
    // match against it. (Real BE contract for this param lands via USDX-253.)
    const redeemStatus = url.searchParams.get('redeemStatus')
    const paymentStatus = url.searchParams.get('paymentStatus')
    const safeStatus = url.searchParams.get('safeStatus')
    const userId = url.searchParams.get('userId')

    let rows = [...orderList]
    if (type) rows = rows.filter((r) => r.type === type)
    if (status) rows = rows.filter((r) => r.status === status)
    if (redeemStatus) rows = rows.filter((r) => r.status === redeemStatus)
    if (paymentStatus) rows = rows.filter((r) => r.paymentStatus === paymentStatus)
    if (safeStatus) rows = rows.filter((r) => r.safeStatus === safeStatus)
    if (userId) rows = rows.filter((r) => r.userId === userId)

    const start = (page - 1) * take
    const data = rows.slice(start, start + take)

    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit: take, total: rows.length },
      data,
    })
  }),

  http.get('/api/v1/orders/:id', ({ params }) => {
    const detail = orderDetails.get(String(params.id))
    if (!detail) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 },
      )
    }
    return HttpResponse.json({ status: 'success', metadata: null, data: detail })
  }),

  // ─── Phase 1 Users — handlers removed in USDX-47 ───
  // /api/v1/users.* are served by the real BE; the browser bypass is set in
  // src/mocks/browser.ts § INTEGRATION_PATHS. Vitest no longer covers users —
  // E2E spec at e2e/usdx-47.spec.ts replaces the old MSW-backed coverage.

  // ─── Phase 1 Mint Submission (sot/openapi.yaml § POST /api/v1/mint) ───
  // Strict bearer auth (sot/openapi.yaml L13-14 global security).
  // Validates body, computes IDR equivalent, picks Safe by threshold,
  // persists as PENDING_APPROVAL, returns the fresh MintRequest detail.
  // 403 (role insufficient) is intentionally not modeled in the mock — Linear
  // AC #6 only verifies the FE displays the message; tests use server.use().
  http.post('/api/v1/mint', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()

    let body: Partial<{
      userId: string
      userAddress: string
      amount: string
      amountCurrency: 'USD' | 'IDR'
      chain: string
      notes: string
    }>
    try {
      body = (await request.json()) as typeof body
    } catch {
      return phaseOneBadRequest('Request body must be valid JSON', 'BAD_REQUEST')
    }

    // sot/api/mint.yaml § CreateMintRequest — required fields.
    const userId = (body.userId ?? '').trim()
    const userAddress = (body.userAddress ?? '').trim()
    const amountRaw = (body.amount ?? '').trim()
    const amountCurrency = body.amountCurrency
    const chain = (body.chain ?? '').trim()
    if (!userId) return phaseOneBadRequest('userId is required')
    if (!userAddress) return phaseOneBadRequest('userAddress is required')
    if (!/^0x[0-9a-fA-F]{40}$/.test(userAddress)) {
      return phaseOneBadRequest('userAddress must match ^0x[0-9a-fA-F]{40}$')
    }
    const amountNum = Number.parseFloat(amountRaw)
    if (!amountRaw) return phaseOneBadRequest('amount is required')
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return phaseOneBadRequest('amount must be a positive decimal')
    }
    if (amountCurrency !== 'USD' && amountCurrency !== 'IDR') {
      return phaseOneBadRequest('amountCurrency must be USD or IDR')
    }
    if (!chain) return phaseOneBadRequest('chain is required')

    // sot/api/mint.yaml L8: validate user (kyc_status = VERIFIED, suspended = false).
    const matchedIdx = customerStore.findIndex((c) => c.id === userId)
    if (matchedIdx === -1) {
      return phaseOneBadRequest('User not found', 'NOT_FOUND')
    }
    const matched = customerStore[matchedIdx]!
    const phaseOneUser = customerToPhaseOneUser(matched, matchedIdx + 1)
    if (phaseOneUser.kycStatus !== 'VERIFIED' || phaseOneUser.suspended) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'User must be VERIFIED and not suspended',
          },
        },
        { status: 403 }
      )
    }

    // sot/phase-1.md L149-154: USD = 1:1 USDX, IDR → divide by rate.
    const RATE_USD_IDR = 16250
    const amountUsdx =
      amountCurrency === 'USD'
        ? amountRaw
        : (amountNum / RATE_USD_IDR).toFixed(6)
    const amountIdr =
      amountCurrency === 'IDR'
        ? Math.round(amountNum)
        : Math.round(amountNum * RATE_USD_IDR)
    const safeType: 'STAFF' | 'MANAGER' =
      amountIdr >= MANAGER_THRESHOLD_IDR ? 'MANAGER' : 'STAFF'

    const user = { id: matched.id, name: `${matched.firstName} ${matched.lastName}`.trim() }

    const pair = createMintFromRequest(
      user,
      operator,
      { userAddress, amount: amountRaw, amountCurrency, chain, notes: body.notes },
      amountIdr,
      amountUsdx,
      safeType
    )
    requestList.unshift(pair.list)
    requestDetails.set(pair.list.id, pair.detail)

    return HttpResponse.json(
      { status: 'success', metadata: null, data: pair.detail },
      { status: 201 }
    )
  }),

  // sot/openapi.yaml § POST /api/v1/burn — submit burn request (OTC).
  // Bearer auth (global `security: [bearerAuth]`); 400 on shape failures;
  // 403 when submitter role can't handle the IDR amount; 201 returns the
  // strict BurnRequest shape (no display extras).
  http.post('/api/v1/burn', async ({ request }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()

    let body: Partial<{
      userId: string
      userAddress: string
      amount: string
      amountCurrency: 'USD' | 'IDR'
      chain: string
      depositTxHash: string
      bankName: string
      bankAccount: string
      notes: string
    }>
    try {
      body = (await request.json()) as typeof body
    } catch {
      return phaseOneBadRequest('Request body must be valid JSON', 'BAD_REQUEST')
    }

    // sot/api/burn.yaml § CreateBurnRequest — required fields.
    const required = ['userId', 'userAddress', 'amount', 'chain', 'depositTxHash', 'bankName', 'bankAccount'] as const
    for (const key of required) {
      const value = body[key]
      if (typeof value !== 'string' || !value.trim()) {
        return phaseOneBadRequest(`${key} is required`)
      }
    }

    const userId = String(body.userId).trim()
    const userAddress = String(body.userAddress).trim()
    const depositTxHash = String(body.depositTxHash).trim()
    const amount = String(body.amount).trim()
    const amountCurrency = body.amountCurrency
    const chain = String(body.chain) as RequestListItem['chain']

    if (amountCurrency !== 'USD' && amountCurrency !== 'IDR') {
      return phaseOneBadRequest('amountCurrency must be USD or IDR')
    }

    if (!isAddress(userAddress)) {
      return phaseOneBadRequest('Invalid userAddress')
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(depositTxHash)) {
      return phaseOneBadRequest(
        'Invalid depositTxHash (expected 0x + 64 hex chars)'
      )
    }

    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return phaseOneBadRequest('amount must be greater than 0')
    }

    // Phase 1 ships polygon-only (sot/phase-1.md § Smart Contract deliverables).
    if (chain !== 'polygon') {
      return phaseOneBadRequest(
        'Unsupported chain (only polygon is enabled in Phase 1)'
      )
    }

    // sot/api/burn.yaml L8: validate user (kyc_status = VERIFIED, suspended = false).
    const matchedIdx = customerStore.findIndex((c) => c.id === userId)
    if (matchedIdx === -1) {
      return phaseOneBadRequest('User not found', 'NOT_FOUND')
    }
    const matchedUser = customerStore[matchedIdx]!
    const phaseOneUser = customerToPhaseOneUser(matchedUser, matchedIdx + 1)
    if (phaseOneUser.kycStatus !== 'VERIFIED' || phaseOneUser.suspended) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'User must be VERIFIED and not suspended',
          },
        },
        { status: 403 }
      )
    }

    const { list, detail } = createBurnRequestFromSubmission(
      {
        userName: phaseOneUser.name ?? phaseOneUser.email,
        userAddress,
        amount,
        amountCurrency,
        chain: 'polygon',
        depositTxHash,
        bankName: String(body.bankName),
        bankAccount: String(body.bankAccount),
        notes: typeof body.notes === 'string' ? body.notes : undefined,
      },
      staff,
      matchedUser
    )

    // sot/openapi.yaml L143 — 403 when submitter role is insufficient for
    // the computed IDR amount. Threshold + role mapping live in roleAuth.
    if (!canHandleAmountIdr(staff.role, Number(detail.amountIdr))) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Insufficient role for this amount' },
        },
        { status: 403 }
      )
    }

    requestList.unshift(list)
    requestDetails.set(detail.id, detail)

    // Strip code-side discriminator (`type`) and display-only extras
    // (`userName`) so the POST response matches sot/api/burn.yaml §
    // BurnRequest exactly.
    const { userName: _name, type: _type, ...burnRequest } = detail
    void _name
    void _type

    return HttpResponse.json(
      { status: 'success', metadata: null, data: burnRequest },
      { status: 201 }
    )
  }),

]
