export type MintingStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'failed'

export type RedeemStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'

export interface MintingRequest {
  id: string
  requester: string
  email: string
  amount: number
  tokenType: string
  bankAccount: string
  walletAddress: string
  transactionHash: string
  fee: number
  network: string
  proofOfTransfer: string
  notes: string
  status: MintingStatus
  createdAt: string
  updatedAt: string
}

export interface RedeemRequest {
  id: string
  requester: string
  amount: number
  bankAccount: string
  bankName: string
  walletAddress: string
  transactionHash: string
  fee: number
  network: string
  notes: string
  status: RedeemStatus
  createdAt: string
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

export interface DashboardStats {
  minting: {
    total: number
    byStatus: Record<MintingStatus, number>
    totalVolume: number
  }
  redeem: {
    total: number
    byStatus: Record<RedeemStatus, number>
    totalVolume: number
  }
  recentActivity: Array<{
    id: string
    type: 'minting' | 'redeem'
    requester: string
    amount: number
    status: string
    createdAt: string
  }>
}

export interface User {
  id: string
  name: string
  email: string
}
