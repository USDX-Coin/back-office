// ─────────────────────────────────────────────────────────────────────────────
// Domain glossary
//
//   Staff    = back-office operator. Shape per sot/openapi.yaml § Staff.
//   Customer = end-customer whose wallet receives USDX on mint / releases on redeem
// ─────────────────────────────────────────────────────────────────────────────

export type OtcStatus = 'pending' | 'completed' | 'failed'

export type Network = 'ethereum' | 'polygon' | 'arbitrum' | 'solana' | 'base'

export type CustomerType = 'personal' | 'organization'

export type CustomerRole = 'admin' | 'editor' | 'member'

// SoT openapi.yaml L744-L746
export type StaffRole = 'STAFF' | 'MANAGER' | 'DEVELOPER' | 'ADMIN'

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

export interface AuthToken {
  accessToken: string
  staff: Staff
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
// SoT-shape Request types (sot/openapi.yaml § Requests, USDX-39)
// ─────────────────────────────────────────────────────────────────────────────

export type RequestType = 'mint' | 'burn'

export type RequestStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTED'
  | 'IDR_TRANSFERRED'
  | 'REJECTED'

export type SafeType = 'STAFF' | 'MANAGER'

export interface RequestListItem {
  id: string
  type: RequestType
  userId: string
  userName: string
  userAddress: string
  amount: string
  amountIdr: string
  chain: string
  safeType: SafeType
  status: RequestStatus
  createdBy: string
  createdAt: string
}

export interface ApiEnvelope<T> {
  status: 'success'
  metadata: PaginationMeta | null
  data: T
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
}

export interface ApiErrorEnvelope {
  status: 'error'
  metadata: null
  data: null
  error: {
    code: string
    message: string
  }
}
