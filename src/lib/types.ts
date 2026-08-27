// ─────────────────────────────────────────────────────────────────────────────
// Domain glossary (see docs/brainstorms/2026-04-16-azure-horizon-redesign-requirements.md)
//
//   Staff    = logged-in back-office operator (admin/ops/compliance/support)
//   Customer = end-customer whose wallet receives USDX on mint / releases on redeem
//   Operator = the current Staff (runtime identity, typed as Staff)
// ─────────────────────────────────────────────────────────────────────────────

export type OtcStatus = 'pending' | 'completed' | 'failed'

export type Network = 'ethereum' | 'polygon' | 'arbitrum' | 'solana' | 'base'

export type CustomerType = 'personal' | 'organization'

export type CustomerRole = 'admin' | 'editor' | 'member'

// SoT openapi.yaml L744-L746
export type StaffRole = 'STAFF' | 'MANAGER' | 'DEVELOPER' | 'ADMIN'

// Roles allowed to write rate config per sot/phase-1.md § Rate Management
// ("admin only") and sot/api/rate.yaml POST 403 response. USDX-62 reverts
// the prior ADMIN+MANAGER allowance after PM decision on USDX-23 drift.
export function canManageRate(role: StaffRole): boolean {
  return role === 'ADMIN'
}

// USDX-207: fee config update is admin-only (sot/api/fee.yaml POST 403).
// GET is readable by all backoffice roles; only the write path is gated.
export function canManageFeeConfig(role: StaffRole): boolean {
  return role === 'ADMIN'
}

// SoT openapi.yaml L697-L717
export interface Staff {
  id: string
  name: string
  email: string
  role: StaffRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// SoT api/staff.yaml § CreateStaff — admin-only POST /api/v1/staff.
export interface CreateStaff {
  name: string
  email: string
  password: string
  role: StaffRole
}

// SoT api/staff.yaml § UpdateStaff — admin-only PATCH /api/v1/staff/:id.
// All fields optional; email and password are not mutable here.
export interface UpdateStaff {
  name?: string
  role?: StaffRole
  isActive?: boolean
}

export interface UserWallet {
  id: string
  chain: Network
  address: string
  createdAt: string
}

// SoT openapi.yaml § UserAnalytics — totals are decimal strings to preserve
// precision; only the transaction count is integer.
export interface UserAnalytics {
  totalMinted: string
  totalBurned: string
  totalTransactions: number
}

export interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  type: CustomerType
  organization?: string
  role: CustomerRole
  notes?: string
  wallets: UserWallet[]
  createdAt: string
}

export interface CustomerDetail extends Customer {
  analytics: UserAnalytics
  recentRequests: ReportRow[]
}

export interface OtcMintTransaction {
  id: string
  txHash: string
  customerId: string
  customerName: string
  operatorStaffId: string
  operatorName: string
  network: Network
  amount: number
  destinationAddress: string
  notes?: string
  status: OtcStatus
  createdAt: string
  settledAt?: string
}

export interface OtcRedeemTransaction {
  id: string
  txHash: string
  customerId: string
  customerName: string
  operatorStaffId: string
  operatorName: string
  network: Network
  amount: number
  status: OtcStatus
  createdAt: string
  settledAt?: string
}

export type OtcTransactionKind = 'mint' | 'redeem'

export interface ReportRow {
  id: string
  kind: OtcTransactionKind
  txHash: string
  customerId: string
  customerName: string
  network: Network
  amount: number
  status: OtcStatus
  createdAt: string
}

// USDX-37: DashboardSnapshot mock-shape removed. Dashboard now consumes
// `DashboardStats` from sot/openapi.yaml § /api/v1/dashboard/stats.

export interface CustomerSummary {
  total: number
  active: number
  organizations: number
}

export interface StaffSummary {
  total: number
  admins: number
  activeNow: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

// ─── Rate (sot/openapi.yaml § /api/v1/rate) ──────────────────────────────────
// All numeric values are decimal strings to preserve precision across the wire.

export type RateMode = 'MANUAL' | 'DYNAMIC'

// USDX-207: spread directional (sot/api/rate.yaml + phase-1.md § Rate
// Configuration). Mengganti `spread_pct` tunggal jadi dua arah: beli (mint)
// pakai `spreadBuyPct`, jual (burn/redeem) pakai `spreadSellPct`. GET juga
// surface effective rate per arah.
export interface RateInfo {
  /** Base rate USD/IDR sebelum spread (manual atau feed). */
  baseRate: string
  mode: RateMode
  /** Spread % saat user beli USDX (mint). */
  spreadBuyPct: string
  /** Spread % saat user jual USDX (burn/redeem). */
  spreadSellPct: string
  /** baseRate × (1 + spreadBuyPct/100). */
  effectiveBuyRate: string
  /** baseRate × (1 − spreadSellPct/100). */
  effectiveSellRate: string
  updatedAt: string
}

export interface UpdateRateConfig {
  mode: RateMode
  manualRate?: string | null
  /** Default 0. */
  spreadBuyPct?: string
  /** Default 0. */
  spreadSellPct?: string
}

export interface RateConfig {
  id: string
  mode: RateMode
  manualRate: string | null
  spreadBuyPct: string
  spreadSellPct: string
  updatedBy: string
  createdAt: string
}

// ─── Fee config (sot/api/fee.yaml § /api/v1/fee-config, USDX-207 + USDX-245) ──
// Append-only, admin-set. Row terbaru = config aktif. Full snapshot:
//  - mint (W2): mint fee (% nominal) + PG fee referensi per channel
//    (VA flat Rp / QRIS % atas subtotal_idr).
//  - redeem (W3): redeem fee (% dari gross_idr) + disbursement fee flat (Rp).
export interface FeeConfig {
  id: string
  mintFeePct: string
  pgFeeVaFlat: string
  pgFeeQrisPct: string
  /** Redeem fee % dari gross_idr (W3). */
  redeemFeePct: string
  /** Disbursement fee Rp flat per payout (W3, referensi sampai provider real). */
  disbursementFeeFlat: string
  updatedBy: string
  createdAt: string
}

// sot/api/fee.yaml § UpdateFeeConfig — POST = full 5-field snapshot (semua
// required). Jangan kirim partial: BE meng-overwrite seluruh row, partial =
// meng-nol-kan fee yang tidak dikirim (USDX-245). Body invalid → 422
// VALIDATION_ERROR (conventions.md § Validation Error — fee-config allowlist).
export interface UpdateFeeConfig {
  mintFeePct: string
  pgFeeVaFlat: string
  pgFeeQrisPct: string
  redeemFeePct: string
  disbursementFeeFlat: string
}

// ─── Threshold (sot/api/threshold.yaml § /api/v1/threshold) ─────────────────
// Decimal string to preserve precision (Rp value can exceed JS Number safe int).

export type ThresholdMode = 'USD' | 'IDR'

export interface ThresholdConfig {
  id: string
  mode: ThresholdMode
  amount: string
  updatedBy: string
  createdAt: string
}

export interface UpdateThresholdConfig {
  mode: ThresholdMode
  amount: string
}

// ─── Transparency (/api/v1/transparency/*) ───────────────────────────────────
// EVERY name below is copied field-for-field from
// catatan/KONTRAK-API-TRANSPARANSI.md § 3 (Endpoint admin). That file is LOCKED
// and shared with the backend — do not "improve" a name here. The previous
// round invented `amount`/`currency`/`custodian`/`isPublished` locally while the
// backend shipped something else, and the columns rendered `undefined`.
//
// The model is an APPEND-ONLY LEDGER (§ 1): no update, no delete, no status
// column, no draft/publish. A wrong figure is corrected by filing a new entry
// in the opposite direction. Reserve balance = SUM(amount) of every entry, and
// the server hands it over pre-computed in `balance`.
//
// Money stays a decimal string end to end (§ 0) — numeric(30,2) exceeds
// Number.MAX_SAFE_INTEGER, so parsing it into a float would corrupt it.

/**
 * `reserve_ledger_entry.entry_type` (§ 1).
 *
 * `MINT` / `BURN` / `REDEEM` are RESERVED for the automatic hooks that come
 * later — the contract puts them in the enum now so the backend never has to
 * migrate again, but nothing writes them in this phase. They can therefore
 * arrive on a READ and must render, while the create form only offers the two
 * values below in `LEDGER_ENTRY_TYPES_SELECTABLE`.
 */
export type LedgerEntryType = 'SEED' | 'ADJUSTMENT' | 'MINT' | 'BURN' | 'REDEEM'

/** The only `entryType` values staff may file (§ 3 `LEDGER_TYPE_NOT_ALLOWED`). */
export const LEDGER_ENTRY_TYPES_SELECTABLE = ['SEED', 'ADJUSTMENT'] as const
export type SelectableLedgerEntryType = (typeof LEDGER_ENTRY_TYPES_SELECTABLE)[number]

/** The only currency accepted this phase (§ 1 / `LEDGER_CURRENCY_UNSUPPORTED`). */
export const LEDGER_SUPPORTED_CURRENCY = 'USD'

/** One row of `GET /api/v1/transparency/ledger` → `data.entries[]`. */
export interface ReserveLedgerEntry {
  id: string
  entryType: LedgerEntryType
  /** Decimal string. MAY be negative — that is how a correction is filed. */
  amount: string
  /** ISO-4217, uppercase. Only `USD` this phase. */
  currency: string
  /** Why the public number moved. Required, min 10 chars. NEVER shown publicly. */
  reason: string
  /** Real-world date of the event (YYYY-MM-DD), not the date it was typed in. */
  occurredAt: string
  createdByName: string
  /** ISO-8601 UTC. */
  createdAt: string
}

/**
 * `data.balance` — the balance of the WHOLE ledger, not of this page.
 * Render it as-is. Summing the visible rows is wrong by construction: the rows
 * are one page of many.
 */
export interface ReserveBalance {
  amount: string
  currency: string
}

/** `GET /api/v1/transparency/ledger?page=1&take=50` → `data`. */
export interface ReserveLedgerPage {
  entries: ReserveLedgerEntry[]
  page: number
  take: number
  total: number
  balance: ReserveBalance
}

/** `POST /api/v1/transparency/ledger` request body. */
export interface CreateLedgerEntryInput {
  entryType: SelectableLedgerEntryType
  amount: string
  currency: string
  reason: string
  occurredAt: string
  /**
   * REQUIRED (§ 3). Without it a transient failure DOUBLES the reserve figure
   * the public sees: the row is written, the 504 hides the response, the
   * operator presses again and the ledger holds two SEEDs. Append-only means
   * the only correction is a negative entry that stays visible forever.
   *
   * Generated ONCE per form-filling attempt — not per click — and re-sent
   * UNCHANGED on every retry of that same attempt. The backend keys a unique
   * index on it and answers a replay with the existing entry and a **200**
   * (a new entry is **201**); the client must treat BOTH as success, because
   * showing the safe replay as an error is what pushes an operator to press
   * again.
   *
   * Must be 16–200 characters (`LEDGER_IDEMPOTENCY_KEY_INVALID`). The lower
   * bound is deliberate: a throwaway key like `"retry"` would collide across
   * unrelated attempts, and a collision silently DROPS a legitimate entry —
   * quieter, and worse, than the duplicate this field exists to prevent.
   */
  idempotencyKey: string
}

/**
 * `error.code` values `POST /ledger` can return (§ 3 validation table).
 *
 * Every one of them is thrown by the SERVICE, and that is deliberate on the
 * backend's side: `CreateLedgerEntryDto` carries nothing but `@Allow()` — no
 * `@IsString`, no `@Matches` — so `ValidationPipe` has no rule to fail and
 * cannot collapse the table into one generic code. A field that is missing
 * altogether, or sent as the wrong type (an `amount` as a JSON number), reaches
 * the service as `unknown` and comes back as the NAMED 422 for that field.
 *
 * An earlier version of this comment said a plain 400 was still possible here.
 * That is true of the ATTESTATION routes, whose DTOs do use class-validator, and
 * it was carried over to the ledger by mistake. On this route the only 400 left
 * is a body that is not JSON at all, which this client cannot send.
 *
 * The list is what the client can PLACE, not everything it can receive: an
 * unrecognised code still renders with `error.message` verbatim.
 */
export type LedgerErrorCode =
  | 'LEDGER_AMOUNT_ZERO'
  | 'LEDGER_AMOUNT_INVALID'
  | 'LEDGER_REASON_TOO_SHORT'
  | 'LEDGER_DATE_IN_FUTURE'
  | 'LEDGER_DATE_INVALID'
  | 'LEDGER_CURRENCY_UNSUPPORTED'
  | 'LEDGER_TYPE_NOT_ALLOWED'
  /**
   * The key was shorter than 16 or longer than 200 characters. No form field
   * owns this one — the operator typed nothing wrong, the client minted a bad
   * key — so it renders at form level (see `LEDGER_ERROR_FIELD`).
   */
  | 'LEDGER_IDEMPOTENCY_KEY_INVALID'
  /**
   * **409, the only non-422 in this list.** The key is already on an entry whose
   * CONTENT differs, so this is not a retry of that entry and nothing was
   * written.
   *
   * The scenario is the one the contract spells out: the operator hits a 504,
   * then spots a typo in the amount and FIXES it before pressing again. The key
   * is unchanged, because the contract mints one per form-filling attempt. Until
   * the backend compared content, that second request was answered with the OLD
   * entry and a success status — the corrected figure was never stored and the
   * wrong one stayed on the public site with nothing on screen to say so.
   *
   * No field owns it either (see `LEDGER_ERROR_FIELD`): what is wrong is the
   * key-and-content pair, not anything the operator typed. It is an ACTIONABLE
   * failure — reload the balance, show it, then offer to re-send under a NEW key
   * if the entry really is a different one.
   */
  | 'LEDGER_IDEMPOTENCY_KEY_CONFLICT'

/** One row of `GET /api/v1/transparency/attestations` → `data.items[]`. */
export interface AttestationReport {
  id: string
  /** Reporting period, `YYYY-MM`. */
  period: string
  title: string
  /**
   * Present on the ADMIN response too, not just the public one — otherwise the
   * download button is an anchor with no href.
   */
  fileUrl: string
  publishedAt: string
  /**
   * Set once the report is revoked. The backend returns revoked rows as well,
   * for the audit trail; the back office MUST filter them out of the active
   * list (§ 3).
   */
  revokedAt: string | null
}

/**
 * `GET /api/v1/transparency/attestations?page=1&take=50` → `data`.
 *
 * The pagination fields are NOT decoration. The backend defaults `take` to 20,
 * and the back office then hides revoked rows on top of that, so a request
 * without an explicit page size shows at most 20 reports — fewer once anything
 * is revoked — while the public page lists up to 24. A report old enough to
 * fall off that first page could not be revoked from here at all, even though
 * the public could still download it. `total` is what tells the screen there is
 * more to fetch, so it is read, not ignored.
 */
export interface AttestationListPage {
  items: AttestationReport[]
  page?: number
  take?: number
  total?: number
}

/**
 * Step 1 request body → `POST /attestations/upload-url`.
 *
 * `period` is REQUIRED and must be `YYYY-MM`: the backend builds `fileKey` from
 * it, and its `CreateAttestationUploadUrlDto` rejects a body without it. This is
 * not an optional convenience field — sending nothing fails validation and the
 * upload button dies on contact with the real API.
 *
 * `sizeBytes` is REQUIRED for a subtler reason (§ 3). The AWS presigner signs
 * `content-length` (and, counter-intuitively, does NOT sign `content-type` —
 * the SDK lists it as unsignable). The browser fills `Content-Length` itself
 * from the real file size and an application cannot override it: it is a
 * forbidden header. So if the backend has to guess a length, the signature
 * never matches and storage answers 403 to EVERY upload. Send `file.size`.
 */
export interface AttestationUploadUrlInput {
  period: string
  /** `file.size`, in bytes. Capped at `ATTESTATION_MAX_FILE_BYTES` (5 MiB). */
  sizeBytes: number
}

/** Step 1 response. */
export interface AttestationUploadTicket {
  uploadUrl: string
  fileKey: string
  /** ISO-8601 UTC. After this the presigned URL stops working. */
  expiresAt: string
  /**
   * The headers the PUT in step 2 MUST send, verbatim.
   *
   * A presigned URL is signed together with a specific set of headers. Sending
   * anything different — including a hand-written `Content-Type` that looks
   * correct — makes the signature not match and storage rejects the upload.
   * Never hardcode these; pass the map through as-is.
   */
  headers: Record<string, string>
}

/** Step 3 of the three-step upload → `POST /attestations` (JSON, NOT multipart). */
export interface CreateAttestationInput {
  period: string
  title: string
  fileKey: string
}

/**
 * `error.code` values the attestation endpoints can return (§ 3).
 *
 * All four of the file-related ones are 422 — they describe something wrong
 * with what the CLIENT did. A storage outage is NOT in this list on purpose:
 * infrastructure failures stay 5xx and fail closed, because translating "the
 * bucket is down" into a validation error would tell an operator to fix a file
 * that has nothing wrong with it.
 */
export type AttestationErrorCode =
  | 'ATTESTATION_PERIOD_EXISTS'
  | 'INVALID_ATTESTATION_PERIOD'
  /** `sizeBytes` above the shared 5 MiB ceiling, raised by step 1. */
  | 'ATTESTATION_FILE_TOO_LARGE'
  /** Step 3 was handed a `fileKey` the backend never issued. */
  | 'INVALID_FILE_KEY'
  /**
   * Step 3 ran but the object is missing or zero-length — step 2 never landed.
   * Registering anyway would publish a row whose public download is broken.
   */
  | 'ATTESTATION_FILE_NOT_UPLOADED'
  /** The bytes in the bucket are not a PDF, whatever the file was named. */
  | 'ATTESTATION_FILE_TYPE_INVALID'

/**
 * Every mutation under /api/v1/transparency (ledger entry, attestation upload,
 * revoke) is ADMIN-only (§ 3). Reading is ADMIN + DEVELOPER and is gated at the
 * route with `RoleGuard`, the same way /settings/threshold is — hiding the
 * buttons alone would still leave the page reachable by URL.
 */
export function canManageTransparency(role: StaffRole): boolean {
  return role === 'ADMIN'
}

/** Roles allowed to READ the transparency ledger (§ 3). */
export const TRANSPARENCY_READ_ROLES: StaffRole[] = ['ADMIN', 'DEVELOPER']

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — mint/burn request lifecycle (see sot/openapi.yaml § /api/v1/requests)
//
// Distinct from OtcMintTransaction / OtcRedeemTransaction (single-shot OTC):
// these requests follow an approval workflow:
//   PENDING_APPROVAL → APPROVED → EXECUTED → (burn only) IDR_TRANSFERRED
//                  └→ REJECTED  (terminal at any stage)
// ─────────────────────────────────────────────────────────────────────────────

export type RequestType = 'mint' | 'burn'

export type SafeType = 'STAFF' | 'MANAGER'

export type RequestChain = 'ethereum' | 'polygon' | 'arbitrum' | 'base'

export type MintRequestStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTED'
  | 'REJECTED'

export type BurnRequestStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTED'
  | 'IDR_TRANSFERRED'
  | 'REJECTED'

export type RequestStatus = MintRequestStatus | BurnRequestStatus

export interface RequestListItem {
  id: string
  type: RequestType
  userId: string
  userName: string
  userAddress: string
  amount: string
  amountIdr: string
  // USDX-35 AC6: badge in the Amount column shows which currency the
  // operator originally typed. Detail responses (MintRequest/BurnRequest)
  // already carry inputCurrency in SoT; the list schema does not yet —
  // optional here so the FE degrades gracefully when BE omits it. Flagged
  // as a proposed openapi extension to sot/api/requests.yaml § RequestListItem.
  inputCurrency?: AmountCurrency
  chain: RequestChain
  safeType: SafeType
  status: RequestStatus
  // USDX-71: BE (sot/api/requests.yaml § RequestListItem) returns both — list
  // rows deep-link to the block explorer (onChainTxHash) and the Safe UI
  // (safeTxHash). `safeTxHash` is null on requests rejected before the Safe TX
  // was proposed; `onChainTxHash` is null until status reaches EXECUTED /
  // IDR_TRANSFERRED.
  safeTxHash: string | null
  onChainTxHash: string | null
  createdBy: string
  // USDX-78: denormalized staff name for the "Created By" column. SoT
  // api/requests.yaml § RequestListItem L117 says BE always denormalizes
  // this on read, so no list-time fetch of staff is needed.
  createdByName: string
  createdAt: string
}

// sot/api/chains.yaml § ChainConfig — GET /api/v1/chains. FE-facing subset of
// the backend ChainConfig: enough to deep-link to the block explorer (tx hash)
// and the Safe UI (safe tx hash). Sensitive fields (rpcUrl, safeServiceUrl,
// signer key) are not exposed.
export interface ChainConfig {
  /** Chain identifier — matches the `chain` field on mint/burn requests, e.g. "polygon". */
  chain: string
  chainId: number
  /** Display name, e.g. "Polygon" / "Polygon Amoy". */
  name: string
  /** Block explorer base URL, no trailing slash. Tx link = `{blockExplorerUrl}/tx/{hash}`. */
  blockExplorerUrl: string
  staffSafeAddress: string
  managerSafeAddress: string
  usdxAddress: string
}

interface RequestDetailBase {
  id: string
  idempotencyKey: string
  userId: string
  // USDX-23: BE detail response currently omits userName. The modal falls
  // back to the list row's userName via the `listItem` prop.
  userName?: string
  userAddress: string
  amount: string
  amountWei: string
  amountIdr: string
  rateUsed: string
  chain: RequestChain
  notes: string | null
  safeType: SafeType
  safeTxHash: string | null
  onChainTxHash: string | null
  createdBy: string
  // USDX-78: SoT api/mint.yaml § MintRequest L134 + api/burn.yaml § BurnRequest
  // L147 include createdByName in the detail shape. Optional defensively —
  // mirrors the userName fallback pattern above; modal falls back to
  // `listItem.createdByName` when the BE detail response omits it.
  createdByName?: string
  createdAt: string
  updatedAt: string
}

// USDX-23: BE detail response currently omits `type` (mint/burn discriminator).
// The modal infers type from the list row's `listItem.type` instead. The
// FE-side type union below stays as documentation of the *intended* shape.
export interface MintRequestDetail extends RequestDetailBase {
  type?: 'mint'
  status: MintRequestStatus
}

export interface BurnRequestDetail extends RequestDetailBase {
  type?: 'burn'
  status: BurnRequestStatus
  // USDX-23: BE detail response untested for burn-specific fields (no burn
  // requests in dev DB at time of integration). Marked optional defensively;
  // the modal renders the burn panel only when at least one is present.
  depositTxHash?: string
  bankName?: string
  bankAccount?: string
}

export type RequestDetail = MintRequestDetail | BurnRequestDetail

// ─── Phase 2 W2 — Consumer Orders (backoffice "User Transaction", USDX-206) ───
// sot/api/orders.yaml + sot/phase-2/week2.md § Backoffice — User Transaction.
// Read-only monitoring of consumer mint orders (distinct from the Phase-1 OTC
// mint/burn `requests` above — different table, different lifecycle). Week 2 is
// mint-only; redeem joins Week 3 and the endpoint + `type` filter are
// union-ready. Field + enum names mirror sot/api/common.yaml exactly.

// sot/api/common.yaml § TransactionType. Week 2 = MINT only; REDEEM efektif W3.
export type TransactionType = 'MINT' | 'REDEEM'

// sot/api/common.yaml § MintPaymentStatus — IDR payment lifecycle of an order.
export type MintPaymentStatus =
  | 'REQUESTED'
  | 'WAITING_FOR_PAYMENT'
  | 'PAID'
  | 'EXPIRED'

// sot/api/common.yaml § MintSafeStatus — on-chain Safe execution (mirrors OTC).
export type MintSafeStatus =
  | 'NONE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTED'
  | 'REJECTED'

// sot/api/common.yaml § MintOrderStatus — denormalized overall order status.
export type MintOrderStatus =
  | 'WAITING_FOR_PAYMENT'
  | 'WAITING_FOR_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'

// sot/api/common.yaml § RedeemStatus — single-dimension redeem lifecycle (W3,
// USDX-245). Redeem tidak lewat Safe: burn = self-sign user, payout =
// disbursement. late_burn (burn setelah EXPIRED) tetap pindah ke BURNED.
export type RedeemStatus =
  | 'AWAITING_BURN'
  | 'BURNED'
  | 'PROCESSING_PAYOUT'
  | 'PAYOUT_COMPLETE'
  | 'EXPIRED'

// Union overall status: MINT → MintOrderStatus, REDEEM → RedeemStatus.
export type OrderStatus = MintOrderStatus | RedeemStatus

// sot/api/common.yaml § PaymentChannel / VaBank.
export type PaymentChannel = 'VA' | 'QRIS'
export type VaBank =
  | 'BCA'
  | 'BNI'
  | 'BRI'
  | 'CIMB'
  | 'DANAMON'
  | 'INA'
  | 'MANDIRI'
  | 'PERMATA'
  | 'MAYBANK'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-547 — partner ownership on an order (migration 0076 already landed:
// mint_orders / redeem_orders carry partner_id + partner_customer_id +
// on_behalf_of + external_reference, and user_id became NULLABLE).
//
// Why a nested object and not a bare `partnerId`: an order row only holds the
// UUID, and a UUID answers nothing an operator can act on. What ops needs when
// a partner order goes wrong is WHO TO CALL, and that is the partner — the
// partner's customer has no relationship with USDX at all (their CDD lives at
// the partner, and they receive no notification from us). So the row must carry
// the resolved `partners` row, which is a LEFT JOIN on the backend side: retail
// orders have no partner_id and an INNER JOIN would drop them from the list.
//
// `code` travels alongside `displayName` because `code` is what gets printed in
// transaction references and stays put when the legal name changes by deed,
// while `displayName` is the human-readable one.
// ─────────────────────────────────────────────────────────────────────────────
export interface OrderPartnerRef {
  id: string
  /** Immutable slug used in transaction references (`partners.code`). */
  code: string
  /** Legal/display name — may change by deed (`partners.display_name`). */
  displayName: string
}

/** `mint_orders.on_behalf_of` / `redeem_orders.on_behalf_of` (migration 0076). */
export type OrderOnBehalfOf = 'SELF' | 'CUSTOMER'

// sot/api/orders.yaml § OrderListItem — GET /api/v1/orders row (union mint +
// redeem). MINT-only fields (totalPayIdr, paymentStatus, safeStatus) are null
// for redeem; netPayoutIdr is null for mint.
export interface OrderListItem {
  id: string
  /**
   * NULL for an order owned by a partner customer — `mint_orders.user_id` /
   * `redeem_orders.user_id` became nullable in migration 0076 precisely for
   * that case. Retail orders always carry it.
   */
  userId: string | null
  type: TransactionType
  /**
   * Retail: the customer's email (masked for non-ADMIN by the backend,
   * USDX-487). Partner-customer orders have no `users` row at all, so the
   * backend sends the literal marker `(partner customer)` — deliberately not an
   * email and not an empty string (USDX-571). Read the Partner column beside it
   * to learn which partner the order belongs to.
   */
  userEmail: string
  /** Resolved `partners` row (LEFT JOIN). NULL for retail orders — USDX-547. */
  partner: OrderPartnerRef | null
  /** SELF = the partner's own order; CUSTOMER = on behalf of its customer. NULL for retail. */
  onBehalfOf: OrderOnBehalfOf | null
  /** Decimal USDX. */
  amount: string
  /** MINT: total the user pays (IDR; null until a channel is chosen). REDEEM: null. */
  totalPayIdr: string | null
  /** REDEEM: IDR the user receives. MINT: null. */
  netPayoutIdr: string | null
  chain: string
  /** MINT only (redeem has no payment leg). */
  paymentStatus: MintPaymentStatus | null
  /** MINT only (redeem tidak lewat Safe). */
  safeStatus: MintSafeStatus | null
  status: OrderStatus
  createdAt: string
}

// sot/api/orders.yaml § OrderDetail — GET /api/v1/orders/{id} (union mint +
// redeem). Adds the fee/spread/revenue breakdown (backoffice-only monitoring,
// never exposed to the consumer). MINT-only block is null for redeem and the
// REDEEM block is null for mint; totalFeeIdr + estimatedRevenueIdr are shared.
export interface OrderDetail {
  id: string
  type: TransactionType
  /** NULL for a partner-customer order (migration 0076 made user_id nullable). */
  userId: string | null
  /** `(partner customer)` when the order has no `users` row — see OrderListItem. */
  userEmail: string
  /** Resolved `partners` row (LEFT JOIN). NULL for retail orders — USDX-547. */
  partner: OrderPartnerRef | null
  /** SELF = partner's own order; CUSTOMER = on behalf of its customer. NULL for retail. */
  onBehalfOf: OrderOnBehalfOf | null
  /**
   * `partner_customers.id` — only when onBehalfOf = CUSTOMER. Shown so ops can
   * quote it back to the partner; it is an opaque id, NOT customer identity.
   */
  partnerCustomerId: string | null
  /**
   * The partner's OWN order number (`external_reference`). This is the number
   * the partner quotes when it reports a problem, so ops has to be able to see
   * (and search) it. NULL for retail orders.
   */
  externalReference: string | null
  /** MINT: address tujuan. REDEEM: wallet sumber burn (null sampai BURNED). */
  userAddress: string | null
  chain: string
  /** Decimal USDX. */
  amount: string
  // ── Exchange rate + spread ──
  /** Rate USD/IDR before spread. */
  baseRate: string
  /** MINT: spread beli (snapshot). REDEEM: null. */
  spreadBuyPct: string | null
  /** REDEEM: spread jual (snapshot). MINT: informasional/null. */
  spreadSellPct: string | null
  /** = rateUsed snapshot (mint = ×(1+buy); redeem = ×(1−sell)). */
  effectiveRate: string
  // ── MINT block (null untuk redeem) ──
  /** MINT only (Safe mint key). */
  idempotencyKey: string | null
  /** MINT: amount × effectiveRate. */
  subtotalIdr: string | null
  paymentChannel: PaymentChannel | null
  /** Bank VA terpilih (null untuk QRIS / redeem). */
  paymentBank: VaBank | null
  mintFeePct: string | null
  mintFeeIdr: string | null
  /** Payment gateway fee (IDR). */
  pgFeeIdr: string | null
  /** MINT: subtotalIdr + totalFeeIdr (user bayar). */
  totalPayIdr: string | null
  /** MINT only (redeem tidak lewat Safe). */
  safeType: SafeType | null
  paymentStatus: MintPaymentStatus | null
  safeStatus: MintSafeStatus | null
  paidAt: string | null
  safeTxHash: string | null
  /** MINT: tx mint. (Redeem pakai burnTxHash.) */
  onChainTxHash: string | null
  /** MINT: payment provider (W2). */
  paymentProvider: string | null
  // ── REDEEM block (null untuk mint) ──
  /** REDEEM: bytes32 id untuk redeem(id, amount). */
  redeemId: string | null
  /** REDEEM: amount × effectiveRate (sebelum fee). */
  grossIdr: string | null
  redeemFeePct: string | null
  /** REDEEM: redeem fee (IDR). */
  redeemFeeIdr: string | null
  /** REDEEM: disbursement fee (IDR). */
  disbursementFeeIdr: string | null
  /** REDEEM: grossIdr − totalFee (user terima). */
  netPayoutIdr: string | null
  bankCode: string | null
  /** REDEEM: nama bank di-resolve dari bankCode (tampil nama, bukan kode). Fallback ke kode kalau tak dikenal. */
  bankName: string | null
  /** REDEEM: nomor rekening PENUH (un-mask 2026-06-25). Decrypt + audit log (BE side-effect). */
  bankAccountNumber: string | null
  /** Decrypt + audit log (BE side-effect). */
  bankAccountName: string | null
  /** REDEEM: burn setelah EXPIRED. */
  lateBurn: boolean | null
  payoutRef: string | null
  /** REDEEM: on-chain redeem tx. */
  burnTxHash: string | null
  burnedAt: string | null
  payoutCompletedAt: string | null
  /** REDEEM: disbursement/payout provider (W3). */
  payoutProvider: string | null
  // ── Shared ──
  /** MINT: mintFee + pgFee. REDEEM: redeemFee + disbursementFee. */
  totalFeeIdr: string | null
  /** MINT: spread_buy_revenue + mintFee. REDEEM: spread_sell_revenue + redeemFee. */
  estimatedRevenueIdr: string
  status: OrderStatus
  expiresAt: string
  createdAt: string
  updatedAt: string
}

// sot/api/burn.yaml § CreateBurnRequest — request body for POST /api/v1/burn.
// USDX-46: userName → userId, add amountCurrency.
export interface CreateBurnRequest {
  userId: string
  userAddress: string
  amount: string
  amountCurrency: AmountCurrency
  chain: RequestChain
  depositTxHash: string
  bankName: string
  bankAccount: string
  notes?: string
}

// sot/api/burn.yaml § BurnRequest — exact response shape for POST /api/v1/burn.
// Strict — does NOT include userName / display extras that BurnRequestDetail
// carries for the /requests detail dialog.
export interface BurnRequest {
  id: string
  idempotencyKey: string
  userId: string
  userAddress: string
  amount: string
  amountWei: string
  amountIdr: string
  inputCurrency: AmountCurrency
  rateUsed: string
  chain: RequestChain
  depositTxHash: string
  bankName: string
  bankAccount: string
  notes: string | null
  safeType: SafeType
  status: BurnRequestStatus
  safeTxHash: string | null
  onChainTxHash: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Phase-1 API envelope (matches openapi.yaml — `metadata` + `limit`)
export interface PhaseOnePaginatedResponse<T> {
  status: 'success'
  metadata: {
    page: number
    limit: number
    total: number
  }
  data: T[]
}

export interface PhaseOneSuccessResponse<T> {
  status: 'success'
  metadata: Record<string, unknown> | null
  data: T
}

// Phase-1 error envelope (sot/openapi.yaml § ErrorResponse)
export interface PhaseOneErrorResponse {
  status: 'error'
  metadata: null
  data: null
  error: {
    code: string
    message: string
    details?: Record<string, string>
  }
}

// ─── Phase 1 — User directory (sot/api/users.yaml + sot/api/common.yaml) ───
// USDX-46: User schema extended with email + KYC/suspension fields per the
// updated SoT. Eligibility for mint/burn = `kycStatus === 'VERIFIED' &&
// suspended === false` (sot/phase-1.md L307 — backend wajib cek both).

export type KycStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
export type EntityType = 'INDIVIDUAL' | 'LEGAL_ENTITY'

// sot/api/common.yaml § AmountCurrency — input currency. USD = USDX (1:1),
// IDR = backend converts using current rate at submission time.
export type AmountCurrency = 'USD' | 'IDR'

export interface PhaseOneUserWallet {
  id: string
  chain: string
  address: string
  createdAt: string
}

// USDX-156 — Phase 2 fields per sot/api/users.yaml § User:
// - `name` is nullable: self-signup users have no name until their first KYC
//   submit auto-sets it (week1.md § users.name populate). Admin-created users
//   always have one (form requires it).
// - `phone` arrives decrypted (ciphertext at rest); nullable on Phase 1 rows.
// - `emailVerifiedAt` null = belum aktivasi; `activationEmailFailedAt` set
//   when the activation email exhausted its retries (job USDX-149).
export type ActivationStatus = 'PENDING' | 'ACTIVATED' | 'FAILED'

export interface PhaseOneUser {
  id: string
  name: string | null
  email: string
  phone: string | null
  entityType: EntityType
  kycStatus: KycStatus
  suspended: boolean
  emailVerifiedAt: string | null
  activationEmailFailedAt: string | null
  notes: string | null
  wallets: PhaseOneUserWallet[]
  createdAt: string
  updatedAt: string
}

// SoT openapi.yaml § UserDetail — extends User with analytics + recent
// mint/burn requests. Returned by GET /api/v1/users/:id.
export interface PhaseOneUserDetail extends PhaseOneUser {
  analytics: UserAnalytics
  recentRequests: RequestListItem[]
}

// sot/api/users.yaml § CreateUser — name + email + entityType required.
// USDX-156 (Phase 2): no password anywhere — the user sets it via the
// activation link (admin-created.html, valid 7 days) that BE auto-sends.
// `phone` is optional at admin-create (format +62xxx / 08xxx, BE normalizes).
export interface PhaseOneCreateUser {
  name: string
  email: string
  phone?: string
  entityType: EntityType
  notes?: string
  wallets?: PhaseOneCreateUserWallet[]
}

// sot/api/users.yaml § ResendActivationResult — POST /users/:id/resend-activation.
// `activationEmailSent: false` = single-attempt SMTP send failed but the token
// WAS rotated; durable retry + activation_email_failed_at is job USDX-149's.
export interface ResendActivationResult {
  activationEmailSent: boolean
}

// sot/api/users.yaml § UpdateUser — admin can mutate name/email/entityType
// plus kycStatus and suspended. Wallet management goes through POST/DELETE
// /api/v1/users/:id/wallets.
export interface PhaseOneUpdateUser {
  name?: string
  email?: string
  entityType?: EntityType
  kycStatus?: KycStatus
  suspended?: boolean
  notes?: string
}

// SoT openapi.yaml § CreateUserWallet — both fields required.
export interface PhaseOneCreateUserWallet {
  chain: string
  address: string
}

// ─── Phase 2 Week 1 — KYC backoffice review (sot/api/kyc.yaml § KycListItem) ───
// USDX-154: rows for the /kyc review list. PII is never present at list level —
// decryption happens only on GET /api/v1/kyc/:id (detail modal, USDX-155).

export interface KycListItem {
  id: string
  userId: string
  userEmail: string
  entityType: EntityType
  status: KycStatus
  submissionCount: number
  submittedAt: string | null
  reviewedAt: string | null
  /** Last reviewing staff's name (denormalized from `staff.name`). */
  reviewedByName: string | null
}

// sot/api/kyc.yaml § IdentityType — Week 1 only KTP; DRIVER_LICENSE deferred.
export type KycIdentityType = 'KTP' | 'DRIVER_LICENSE'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-545 — CDD value sets for retail KYC.
//
// These are COPIED, value for value, from the partner cluster
// (`backend/src/database/schema/partner/partner-customer-kyc.ts` §
// "CDD value sets": partner_occupation / partner_source_of_funds /
// partner_annual_income_range / partner_transaction_purpose). Copied and not
// merely "similar" on purpose: the partner API already obliges partners to hand
// over a full CDD block for their customers, so if retail is judged on a
// different or smaller set, one legal entity ends up running TWO CDD standards
// — with the weaker one applied to the customers who deal with USDX directly.
// A combined report or a sanctions sweep would then have to handle two shapes
// of data for the same question.
//
// The income labels carry the resolved spelling (UNDER_ / FROM_..._TO_ / OVER_).
// The earlier partner draft had `100M_500M` / `500M_1B`, which a generated
// client turns into an illegal enum member name — do not reintroduce a value
// that starts with a digit (sot/conventions.md § Naming Conventions).
// ─────────────────────────────────────────────────────────────────────────────
export type KycOccupation =
  | 'PRIVATE_EMPLOYEE'
  | 'SELF_EMPLOYED'
  | 'CIVIL_SERVANT'
  | 'STUDENT'
  | 'OTHER'

export type KycSourceOfFunds =
  | 'SALARY'
  | 'BUSINESS'
  | 'INVESTMENT'
  | 'INHERITANCE'
  | 'OTHER'

export type KycAnnualIncomeRange =
  | 'UNDER_100M'
  | 'FROM_100M_TO_500M'
  | 'FROM_500M_TO_1B'
  | 'OVER_1B'

export type KycTransactionPurpose = 'INVESTMENT' | 'PAYMENT' | 'REMITTANCE' | 'OTHER'

// sot/api/kyc.yaml § KycReviewAction — append-only audit log actions.
export type KycReviewAction =
  | 'SUBMITTED'
  | 'VIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RESUBMITTED'
  | 'PURGED'

// sot/api/kyc.yaml § KycDetail — USDX-155. PII arrives DECRYPTED from the
// backend (every GET writes a VIEWED audit row server-side). PII fields are
// nullable: the retention sweeper NULLs ciphertext after the retention period.
// Photo URLs are presigned GETs with a 5-minute TTL (`urlExpiresAt`); null
// once the object has been purged.
export interface KycDetail {
  id: string
  userId: string
  userEmail: string
  entityType: EntityType
  status: KycStatus
  submissionCount: number
  firstName: string | null
  lastName: string | null
  dob: string | null
  birthPlace: string | null
  identityType: KycIdentityType
  identityNumber: string | null
  country: string | null
  addressLine1: string | null
  addressLine2: string | null
  ktpPhotoUrl: string | null
  selfiePhotoUrl: string | null
  urlExpiresAt: string | null
  // ── CDD block (USDX-545) ──────────────────────────────────────────────────
  // Nullable across the board, and not only because the retention sweeper NULLs
  // PII: every customer VERIFIED before this ticket shipped has an empty CDD
  // block, and how those are treated (left alone / asked at the next
  // transaction / a fill-in campaign) is an open PM decision. The review page
  // must therefore render "—" for a missing value rather than assume presence.
  occupation: KycOccupation | null
  sourceOfFunds: KycSourceOfFunds | null
  annualIncomeRange: KycAnnualIncomeRange | null
  transactionPurpose: KycTransactionPurpose | null
  /**
   * Indonesian tax number. **PII** — ciphertext at rest, decrypted for render,
   * and role-gated to ADMIN in the UI (`canReadCustomerPii`).
   */
  npwp: string | null
  /** `true` = the customer or a close relative holds public office. */
  pepStatus: boolean | null
  /**
   * Free text describing the PEP relationship, expected only when
   * `pepStatus === true`. **PII** — it names a real person and their office, so
   * it is gated exactly like `npwp`.
   */
  pepRelation: string | null
  rejectionReason: string | null
  submittedAt: string | null
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

// sot/api/kyc.yaml § KycReviewLog — one audit-trail row. actorStaffId is
// non-null for VIEWED/APPROVED/REJECTED, actorUserId for SUBMITTED/RESUBMITTED.
export interface KycReviewLog {
  id: string
  action: KycReviewAction
  actorStaffId: string | null
  actorStaffName: string | null
  actorUserId: string | null
  reason: string | null
  ipAddress: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — KYB (business entity due diligence), MANUAL back-office flow.
//
// Two facts shape this contract, both verified in the 27 Aug correction on the
// ticket:
//   1. A LEGAL_ENTITY account can ALREADY be created today by an ADMIN through
//      `POST /api/v1/users` (its DTO validates `["INDIVIDUAL","LEGAL_ENTITY"]`
//      and the service rejects nothing). What is missing is a place to KEEP the
//      entity's due-diligence data — `kyb` / `kyc_ubo` are declared in
//      `backend/src/database/schema/kyc.ts` but never exported, so they do not
//      exist in the database (`SELECT tablename FROM pg_tables …` → 0 rows).
//   2. KYB is a MANUAL flow, not a public API (decision Mas Yan). There is no
//      consumer app submitting this: a USDX operator types it in. That is why
//      this feature has a FORM as well as a review action, unlike retail KYC.
//
// Field names mirror the (to-be-corrected) `kyb` / `kyc_ubo` declarations so the
// FE is not inventing a second vocabulary. The review lifecycle reuses
// `KycStatus`, matching what `partner_customer_kyc.status` already does.
// ─────────────────────────────────────────────────────────────────────────────

/** `kyb.entity_type` — legal form of the entity (not `users.entity_type`). */
export type KybEntityForm = 'PT' | 'CV' | 'YAYASAN' | 'KOPERASI' | 'FIRMA' | 'OTHER'

/** One document attached to a KYB record. `kind` names what the file proves. */
export type KybDocumentKind =
  | 'AKTA_PENDIRIAN'
  | 'NIB'
  | 'NPWP'
  | 'SK_KEMENKUMHAM'
  | 'KTP_DIREKSI'
  | 'OTHER'

export interface KybDocument {
  id: string
  kind: KybDocumentKind
  fileName: string
  /**
   * Presigned GET, short TTL — same treatment as the KYC photos. NULL once the
   * object has been purged by the retention sweeper.
   */
  url: string | null
  sizeBytes: number
  uploadedAt: string
}

/**
 * Ultimate beneficial owner (`kyc_ubo`). `identityNumber` is PII: ciphertext at
 * rest, decrypted for render, ADMIN-only in the UI (`canReadCustomerPii`).
 */
export interface KybUbo {
  id: string
  firstName: string | null
  lastName: string | null
  /** Decimal percent, e.g. "25.50" (`kyc_ubo.ownership_pct numeric(5,2)`). */
  ownershipPct: string
  identityType: KycIdentityType
  /** **PII** — ADMIN-only in the UI. */
  identityNumber: string | null
  country: string | null
  addressLine1: string | null
  addressLine2: string | null
}

/** GET /api/v1/kyb row — no PII at list level (same rule as the KYC list). */
export interface KybListItem {
  id: string
  userId: string
  userEmail: string
  entityName: string
  /** `kyb.registration_number` — NIB. Not PII (it identifies a company). */
  registrationNumber: string
  status: KycStatus
  uboCount: number
  submittedAt: string | null
  reviewedAt: string | null
  reviewedByName: string | null
}

/** GET /api/v1/kyb/:id — the full record the reviewer decides on. */
export interface KybDetail {
  id: string
  userId: string
  userEmail: string
  status: KycStatus
  entityName: string
  entityForm: KybEntityForm
  country: string
  registrationNumber: string
  /** Entity NPWP. A company tax number, not a person's — not role-gated. */
  taxId: string
  /** ISO `YYYY-MM-DD`. */
  establishmentDate: string
  businessSector: string
  registeredAddress: string
  operationalAddress: string
  website: string | null
  phone: string | null
  ubos: KybUbo[]
  documents: KybDocument[]
  /** Presigned document URLs share one expiry stamp, like the KYC photos. */
  urlExpiresAt: string | null
  rejectionReason: string | null
  submittedAt: string | null
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

/** POST /api/v1/kyb/:id/documents/upload-url — step 1 of the three-step upload. */
export interface KybDocumentUploadTicket {
  uploadUrl: string
  fileKey: string
  expiresAt: string
  /** Signed headers — sent to storage VERBATIM (see transparency § upload). */
  headers: Record<string, string>
}

export interface KybUboInput {
  firstName: string
  lastName: string
  ownershipPct: string
  identityType: KycIdentityType
  identityNumber: string
  country: string
  addressLine1: string
  addressLine2?: string
}

/** POST /api/v1/kyb — operator-entered record for an existing LEGAL_ENTITY user. */
export interface CreateKybBody {
  userId: string
  entityName: string
  entityForm: KybEntityForm
  country: string
  registrationNumber: string
  taxId: string
  establishmentDate: string
  businessSector: string
  registeredAddress: string
  operationalAddress: string
  website?: string
  phone: string
  ubos: KybUboInput[]
}

// ─── Phase 1 — Create mint/burn request (sot/api/mint.yaml + burn.yaml) ───
// USDX-46: forms now submit `userId` (operator picks from existing users)
// + `amountCurrency` (USD/IDR — BE converts IDR using current rate).

export interface CreateMintRequestBody {
  userId: string
  userAddress: string
  amount: string
  amountCurrency: AmountCurrency
  chain: string
  notes?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — dashboard statistics (sot/openapi.yaml § /api/v1/dashboard/stats)
//
// All on-chain quantities and Safe balances are decimal strings (USDX has
// 6 on-chain decimals; the API returns the human-readable form so the
// client never has to reason about wei).
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSupply: string
  totalMinted: string
  totalBurned: string
  pendingRequests: number
  requestsByStatus: {
    PENDING_APPROVAL: number
    APPROVED: number
    EXECUTED: number
    REJECTED: number
  }
  safeBalances: {
    staff: string
    manager: string
  }
  currentRate: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting (sot/phase-1.md § Reporting, sot/api/reporting.yaml)
//
// Aggregate read-only reports over mint/burn. All four endpoints accept
// `?format=csv` for direct file download — JSON response shape is the
// SuccessResponse envelope with `data` = the row array below.
// ─────────────────────────────────────────────────────────────────────────────

export type ReportKind = 'mint-daily' | 'mint-by-user' | 'burn-daily' | 'burn-by-user'

export interface ReportFilter {
  startDate: string // YYYY-MM-DD, Asia/Jakarta (inclusive)
  endDate: string // YYYY-MM-DD, Asia/Jakarta (inclusive)
  chain?: string
  status?: string
  userId?: string // only meaningful for *-by-user reports
}

export interface DailyMintRow {
  date: string
  totalCount: number
  totalAmountUsdx: string
  totalAmountIdr: string
  countPendingApproval: number
  countApproved: number
  countExecuted: number
  countRejected: number
}

export interface DailyBurnRow {
  date: string
  totalCount: number
  totalAmountUsdx: string
  totalAmountIdr: string
  countPendingApproval: number
  countApproved: number
  countExecuted: number
  countIdrTransferred: number
  countRejected: number
}

export interface ByUserRow {
  userId: string
  userName: string
  userEmail: string
  totalCount: number
  totalAmountUsdx: string
  totalAmountIdr: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Manual Sync (sot/api/manual-sync.yaml, sot/phase-1.md § Manual Sync)
//
// Recovery surface for the case when the auto Status Sync job fails (Safe API
// or indexer down) and a request stays stuck in PENDING_APPROVAL / APPROVED
// even though the tx already executed on-chain. Manual Sync lets the operator
// paste the tx hash, get a per-field on-chain vs DB comparison, and (if it
// all matches) flip the row to EXECUTED — unblocking the 1-pending-per-Safe
// queue (sot/phase-1.md § Safe Propose Queue).
// ─────────────────────────────────────────────────────────────────────────────

// sot/api/manual-sync.yaml § ManualSyncItem.type / MatchResult.requestType —
// enum [mint, burn, mint_order]. Manual Sync was extended to consumer
// `mint_orders` in Phase 2 W2 (USDX-208). Kept separate from `RequestType`
// (OTC-only, used by RequestListItem) so the OTC types can't accidentally
// accept `mint_order`.
export type ManualSyncType = 'mint' | 'burn' | 'mint_order'

// sot/api/manual-sync.yaml § ManualSyncItem — row shape for the list table.
// Subset of MintRequestDetail / BurnRequestDetail / MintOrder; BE pre-resolves
// `safeAddress` from `safeType` + chain config so the FE doesn't have to.
// For `mint_order`, `status` carries the order's `safe_status`
// (PENDING_APPROVAL / APPROVED).
export interface ManualSyncItem {
  id: string
  type: ManualSyncType
  chain: string
  userId: string
  userName: string
  userAddress: string
  amount: string // decimal USDX
  amountWei: string
  safeType: SafeType
  safeAddress: string
  status: 'PENDING_APPROVAL' | 'APPROVED'
  safeTxHash: string | null
  idempotencyKey: string // bytes32 hex
  createdAt: string
}

// sot/api/manual-sync.yaml § MatchField — one row of the Data Comparison
// table rendered in the Update Transaction Hash modal.
export interface MatchField {
  // Known values today: 'safeAddress' | 'amount' | 'destination' | 'idempotencyKey' | 'safeTxHash'
  // Kept as `string` because the SoT schema doesn't lock it to an enum, and
  // burn omits `destination` so the set is dynamic per request type.
  field: string
  requestData: string
  blockchainData: string
  match: boolean
}

// sot/api/manual-sync.yaml § MatchResult — verify endpoint response payload.
// `allMatch === true` gates the Confirm button in the modal.
export interface MatchResult {
  requestId: string
  requestType: ManualSyncType
  txHash: string
  allMatch: boolean
  fields: MatchField[]
}

// Request body for POST /api/v1/manual-sync/:id/{verify,execute}.
// sot/api/manual-sync.yaml § VerifyRequest.
export interface ManualSyncTxHashBody {
  txHash: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — W4 Multisig (USDX-275, sot/api/multisig.yaml, sot/phase-2/week4.md)
//
// Self-hosted Safe coordination: the `/multisig` page is the queue of Safe
// transactions (mint/burn auto-proposed by the backend + governance ops). Owners
// connect a wallet and sign the SafeTx EIP-712; any operator executes
// `execTransaction`. Status is TX-level (finer than the per-request safe_status)
// and follows the queue tabs.
// ─────────────────────────────────────────────────────────────────────────────

// sot/api/multisig.yaml § SafeActivity — operation decoded from the calldata.
// UNKNOWN = calldata the backend decoder couldn't resolve → blind-sign guard.
export type SafeActivity =
  | 'MINT'
  | 'BURN'
  | 'ADD_BLACKLIST'
  | 'REMOVE_BLACKLIST'
  | 'DESTROY_FUNDS'
  | 'PAUSE'
  | 'UNPAUSE'
  | 'SET_SUPPORTED_CHAIN'
  | 'GRANT_ROLE'
  | 'REVOKE_ROLE'
  | 'MINT_BRIDGE'
  | 'TIMELOCK_SCHEDULE'
  | 'TIMELOCK_EXECUTE'
  | 'UNKNOWN'

// sot/api/multisig.yaml § SafeTxStatus + conventions.md § Status Enums (TX-level).
// PENDING_SIGN → READY_TO_EXECUTE → CONFIRMING → EXECUTED | FAILED | CANCELLED.
export type SafeTxStatus =
  | 'PENDING_SIGN'
  | 'READY_TO_EXECUTE'
  | 'CONFIRMING'
  | 'EXECUTED'
  | 'FAILED'
  | 'CANCELLED'

// Signatures collected vs the Safe threshold (drives the progress bar + the
// "X/Y" label). READY_TO_EXECUTE once collected ≥ threshold.
export interface SignatureProgress {
  collected: number
  threshold: number
}

// sot/api/multisig.yaml § SafeTxListItem — one row in the queue table.
export interface SafeTxListItem {
  id: string
  chain: string
  safeType: SafeType
  safeAddress: string
  nonce: number
  activity: SafeActivity
  /** Human label decoded by the backend, e.g. "Mint 100 USDX → 0xUser". */
  activityLabel: string
  signatureProgress: SignatureProgress
  proposerType: 'BACKEND' | 'STAFF'
  proposerAddress: string
  status: SafeTxStatus
  safeTxHash: string
  execTxHash: string | null
  createdAt: string
}

// One Safe owner's signing state (sot/api/multisig.yaml § SafeTxDetail.signers).
export interface SafeTxSigner {
  address: string
  staffName: string | null
  isBackend: boolean
  signed: boolean
  signedAt: string | null
}

// sot/api/multisig.yaml § SafeTxDetail.execPayload — the `execTransaction`
// params, ready to send, exposed only while READY_TO_EXECUTE. `signatures` is
// already concatenated + sorted ascending by owner address (checkSignatures req).
export interface SafeExecPayload {
  to: string
  value: string
  data: string
  operation: number
  safeTxGas: string
  baseGas: string
  gasPrice: string
  gasToken: string
  refundReceiver: string
  signatures: string
}

// sot/api/multisig.yaml § SafeTxDetail — full TX incl. decoded args (display +
// blind-sign guard), signer states, linked request/order, and exec payload.
export interface SafeTxDetail extends SafeTxListItem {
  to: string
  value: string
  data: string
  operation: number
  /** Decoded calldata args for display + cross-check vs intent (blind-sign guard). */
  decodedArgs: Record<string, unknown>
  linkedRequestId: string | null
  linkedOrderId: string | null
  signers: SafeTxSigner[]
  execPayload: SafeExecPayload | null
  /** Decoded revert reason if the last execTransaction failed (GS013 / USDX custom error). */
  lastExecError: string | null
  executedByStaffName: string | null
  executedAt: string | null
}

// sot/api/multisig.yaml § SafeMeta — GET /api/v1/multisig/safes. Used to render
// the queue + validate whether the connected wallet is an owner (signer gate).
export interface SafeMeta {
  chain: string
  safeType: SafeType
  safeAddress: string
  threshold: number
  owners: string[]
  nonce: number
  /** Native (POL) balance — informational. Gas for execTransaction is paid by the executor wallet, not the Safe. */
  balanceNative: string
  lastSyncedAt: string
}

// POST /api/v1/multisig/{id}/confirm body (sot/api/multisig.yaml § confirm).
export interface SafeConfirmBody {
  signerAddress: string
  signature: string
}

// POST /api/v1/multisig/{id}/execute body (sot/api/multisig.yaml § execute).
export interface SafeExecuteBody {
  execTxHash: string
}

// POST /api/v1/multisig/{id}/cancel body (sot/api/multisig.yaml § cancel).
export interface SafeCancelBody {
  reason?: string
}

// ─── USDX-280 — Propose governance (sot/api/multisig.yaml § propose) ─────────
// The governance subset of SafeActivity that an operator can propose from the
// backoffice (MINT/BURN/MINT_BRIDGE are auto-proposed by the backend, never via
// this modal; UNKNOWN is not proposable). Verified live against the BE enum.
export type GovernanceOperation =
  | 'ADD_BLACKLIST'
  | 'REMOVE_BLACKLIST'
  | 'DESTROY_FUNDS'
  | 'PAUSE'
  | 'UNPAUSE'
  | 'SET_SUPPORTED_CHAIN'
  | 'GRANT_ROLE'
  | 'REVOKE_ROLE'
  | 'TIMELOCK_SCHEDULE'
  | 'TIMELOCK_EXECUTE'

// POST /api/v1/multisig/propose body (sot/api/multisig.yaml § ProposeRequest).
// `params` shape depends on `operation` (see src/lib/multisig/propose.ts). The
// backend encodes the calldata + simulates before storing PENDING_SIGN. `chain`
// is optional (W4 Polygon-only → backend defaults to polygon).
export interface ProposeRequest {
  safeType: SafeType
  operation: GovernanceOperation
  params: Record<string, unknown>
  chain?: string
}

// ─── Kontak on-call insiden uang (USDX-485, audit alur uang P1-18) ───
//
// Backend membaca daftar ini setiap kali mengirim alarm kondisi uang dan
// menyisipkan kontak yang cocok kategorinya ke dalam pesan alarm. Halaman
// setting-nya yang membuat daftar itu bisa diperbarui tanpa deploy — dokumen
// runbook statis cepat basi (orang berganti, nomor berganti), data yang dibaca
// sistem ikut hidup.

export type OncallChannel = 'PHONE' | 'EMAIL' | 'SLACK'

/**
 * Kategori insiden yang ditangani satu kontak. Backend memetakan kode kondisi
 * alarm ke kategori ini (`resolveIncidentCategory`), mis. `PAYOUT_QUEUE_JAMMED`
 * → PAYOUT, `BNI_UNEXPLAINED_INFLOW` → RECONCILIATION. `OTHER` adalah jaring
 * pengaman untuk kondisi baru yang belum dipetakan.
 */
export type OncallIncidentCategory =
  | 'PAYOUT'
  | 'RECONCILIATION'
  | 'MINT'
  | 'REDEEM'
  | 'FRAUD'
  | 'SECURITY'
  | 'INFRA'
  | 'OTHER'

export const ONCALL_CHANNELS: readonly OncallChannel[] = ['PHONE', 'EMAIL', 'SLACK']

export const ONCALL_INCIDENT_CATEGORIES: readonly OncallIncidentCategory[] = [
  'PAYOUT',
  'RECONCILIATION',
  'MINT',
  'REDEEM',
  'FRAUD',
  'SECURITY',
  'INFRA',
  'OTHER',
]

/** Label yang menerangkan kategori — nama enum saja tak cukup untuk memilih dengan benar. */
export const ONCALL_CATEGORY_HINTS: Record<OncallIncidentCategory, string> = {
  PAYOUT: 'Payout gagal, antrean buntu, plafon habis, rem darurat',
  RECONCILIATION: 'Saldo tak terjelaskan, selisih rekonsiliasi bank',
  MINT: 'Pembayaran masuk tak dikredit, callback tak tercocokkan',
  REDEEM: 'Burn nasabah ditolak scanner, selisih jumlah burn',
  FRAUD: 'Aturan FDS menyala (velocity, structuring, fan-in)',
  SECURITY: 'Brute force login, aksi sensitif backoffice',
  INFRA: 'Kanal alert mati, transaksi Safe dibatalkan',
  OTHER: 'Kondisi baru yang belum dipetakan ke kategori mana pun',
}

/**
 * Kontak on-call. `contactValue` bisa berupa nomor telepon = PII, dan menurut
 * tabel role di `sot/conventions.md § Audit Akses PII` hanya ADMIN yang boleh
 * melihat telepon — karena itu BACA pun digerbangi ADMIN di sini, tidak seperti
 * fee/rate yang GET-nya terbuka untuk semua role backoffice.
 */
export interface OncallContact {
  id: string
  name: string
  role: string
  channel: OncallChannel
  contactValue: string
  categories: OncallIncidentCategory[]
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateOncallContact {
  name: string
  role: string
  channel: OncallChannel
  contactValue: string
  categories: OncallIncidentCategory[]
}

export type UpdateOncallContact = Partial<CreateOncallContact>

// USDX-485: seluruh permukaan kontak on-call (baca DAN tulis) admin-only —
// lihat alasannya di komentar OncallContact di atas.
export function canManageOncallContacts(role: StaffRole): boolean {
  return role === 'ADMIN'
}
