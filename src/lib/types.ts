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

export interface RateInfo {
  rate: string
  mode: RateMode
  spreadPct: string
  updatedAt: string
}

export interface UpdateRateConfig {
  mode: RateMode
  manualRate?: string | null
  spreadPct?: string
}

export interface RateConfig {
  id: string
  mode: RateMode
  manualRate: string | null
  spreadPct: string
  updatedBy: string
  createdAt: string
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

export interface PhaseOneUser {
  id: string
  name: string
  email: string
  entityType: EntityType
  kycStatus: KycStatus
  suspended: boolean
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
export interface PhaseOneCreateUser {
  name: string
  email: string
  entityType: EntityType
  notes?: string
  wallets?: PhaseOneCreateUserWallet[]
}

// USDX-47 S4 + AC5: POST /api/v1/users returns User + auto-generated password
// (one-time, plain). USDX-13 BE module spec: "auto-generated password (random
// 16 char), hashed, returned plain in response (one-time)". Field is optional
// at the type level so the FE degrades gracefully when BE hasn't shipped the
// reveal yet (verified empirically against usdx-backend-api — currently absent).
export interface PhaseOneCreateUserResponse extends PhaseOneUser {
  password?: string
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

// sot/api/manual-sync.yaml § ManualSyncItem — row shape for the list table.
// Subset of MintRequestDetail / BurnRequestDetail; BE pre-resolves `safeAddress`
// from `safeType` + chain config so the FE doesn't have to.
export interface ManualSyncItem {
  id: string
  type: RequestType
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
  requestType: RequestType
  txHash: string
  allMatch: boolean
  fields: MatchField[]
}

// Request body for POST /api/v1/manual-sync/:id/{verify,execute}.
// sot/api/manual-sync.yaml § VerifyRequest.
export interface ManualSyncTxHashBody {
  txHash: string
}
