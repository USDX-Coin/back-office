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

export interface UserWallet {
  id: string
  chain: Network
  address: string
  createdAt: string
}

export interface UserAnalytics {
  totalMinted: number
  totalBurned: number
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
