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

// SoT-defined role enum (sot/openapi.yaml § StaffRole). Used by features that
// must mirror backend authorization exactly (e.g. POST /api/v1/rate gates on
// ADMIN/MANAGER). Existing StaffRole values are mapped via mapStaffRoleToSoT.
export type SoTRole = 'STAFF' | 'MANAGER' | 'DEVELOPER' | 'ADMIN'

const STAFF_TO_SOT_ROLE: Record<StaffRole, SoTRole> = {
  super_admin: 'ADMIN',
  operations: 'MANAGER',
  compliance: 'STAFF',
  support: 'STAFF',
}

export function mapStaffRoleToSoT(role: StaffRole): SoTRole {
  return STAFF_TO_SOT_ROLE[role]
}

// Roles allowed to write rate config per sot/phase-1.md § Rate Management
// ("admin/manager only") and openapi.yaml /api/v1/rate POST 403 response.
export function canManageRate(role: StaffRole | SoTRole): boolean {
  const sot = (role === 'STAFF' || role === 'MANAGER' || role === 'DEVELOPER' || role === 'ADMIN')
    ? role
    : mapStaffRoleToSoT(role)
  return sot === 'ADMIN' || sot === 'MANAGER'
}

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
