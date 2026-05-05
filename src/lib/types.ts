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

export type StaffRole = 'support' | 'operations' | 'compliance' | 'super_admin'

export interface Staff {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: StaffRole
  displayName: string
  createdAt: string
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
  createdAt: string
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

export interface DashboardSnapshot {
  kpis: {
    totalMintVolume30d: number
    totalRedeemVolume30d: number
    activeUsers: number
    pendingTransactions: number
    trends: {
      mintVolume: { direction: 'up' | 'down'; percentChange: number }
      redeemVolume: { direction: 'up' | 'down'; percentChange: number }
      activeUsers: { direction: 'up' | 'down'; percentChange: number }
    }
  }
  volumeTrend: Array<{ date: string; mint: number; redeem: number }>
  recentActivity: Array<ReportRow>
  networkDistribution: Array<{ network: Network; count: number; share: number }>
}

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

export interface ReportInsights {
  totalVolume: number
  activeMinters: number
  flagged: number
  trends: {
    volume: { direction: 'up' | 'down'; percentChange: number }
    minters: { direction: 'up' | 'down'; percentChange: number }
  }
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
  chain: RequestChain
  safeType: SafeType
  status: RequestStatus
  // Safe transaction hash (nullable). Present once the backend has proposed
  // the Safe multisig transaction (sot/phase-1.md § Mint / Burn flow steps
  // 6–8). The Notifications page needs this on the list response to deep-link
  // each pending row to the Safe UI without an extra fetch — flagged as a
  // proposed openapi extension on USDX-19.
  safeTxHash: string | null
  createdBy: string
  createdAt: string
}

interface RequestDetailBase {
  id: string
  idempotencyKey: string
  userId: string
  userName: string
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

export interface MintRequestDetail extends RequestDetailBase {
  type: 'mint'
  status: MintRequestStatus
}

export interface BurnRequestDetail extends RequestDetailBase {
  type: 'burn'
  status: BurnRequestStatus
  depositTxHash: string
  bankName: string
  bankAccount: string
}

export type RequestDetail = MintRequestDetail | BurnRequestDetail

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
