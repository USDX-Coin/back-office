import type { MintingRequest, RedeemRequest, DashboardStats, MintingStatus, RedeemStatus } from '@/lib/types'

let idCounter = 1

export function createMintingRequest(overrides: Partial<MintingRequest> = {}): MintingRequest {
  const id = String(idCounter++)
  return {
    id,
    requester: `User ${id}`,
    email: `user${id}@example.com`,
    amount: 10000 + Number(id) * 1000,
    tokenType: 'USDX',
    bankAccount: `1234567890${id}`,
    walletAddress: `0x${id.padStart(40, 'a')}`,
    transactionHash: `0x${id.padStart(64, 'b')}`,
    fee: 10,
    network: 'Ethereum',
    proofOfTransfer: `https://example.com/proof-${id}.png`,
    notes: '',
    status: 'pending',
    createdAt: new Date(2026, 2, 25 - Number(id)).toISOString(),
    updatedAt: new Date(2026, 2, 25 - Number(id)).toISOString(),
    ...overrides,
  }
}

export function createRedeemRequest(overrides: Partial<RedeemRequest> = {}): RedeemRequest {
  const id = String(idCounter++)
  return {
    id,
    requester: `User ${id}`,
    amount: 5000 + Number(id) * 500,
    bankAccount: `9876543210${id}`,
    bankName: 'Bank Central Asia',
    walletAddress: `0x${id.padStart(40, 'c')}`,
    transactionHash: `0x${id.padStart(64, 'd')}`,
    fee: 5,
    network: 'Ethereum',
    notes: '',
    status: 'pending',
    createdAt: new Date(2026, 2, 25 - Number(id)).toISOString(),
    ...overrides,
  }
}

export function resetIdCounter() {
  idCounter = 1
}

const mintingStatuses: MintingStatus[] = ['pending', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'failed']
const redeemStatuses: RedeemStatus[] = ['pending', 'processing', 'completed', 'failed']

export function createMockMintingList(count = 25): MintingRequest[] {
  resetIdCounter()
  return Array.from({ length: count }, (_, i) =>
    createMintingRequest({
      status: mintingStatuses[i % mintingStatuses.length],
    })
  )
}

export function createMockRedeemList(count = 20): RedeemRequest[] {
  resetIdCounter()
  return Array.from({ length: count }, (_, i) =>
    createRedeemRequest({
      status: redeemStatuses[i % redeemStatuses.length],
    })
  )
}

export function createMockDashboardStats(): DashboardStats {
  return {
    minting: {
      total: 150,
      byStatus: {
        pending: 20,
        under_review: 15,
        approved: 30,
        rejected: 10,
        processing: 25,
        completed: 45,
        failed: 5,
      },
      totalVolume: 1500000,
    },
    redeem: {
      total: 80,
      byStatus: {
        pending: 10,
        processing: 15,
        completed: 50,
        failed: 5,
      },
      totalVolume: 800000,
    },
    recentActivity: [
      { id: '1', type: 'minting', requester: 'Alice', amount: 50000, status: 'pending', createdAt: new Date(2026, 2, 25).toISOString() },
      { id: '2', type: 'redeem', requester: 'Bob', amount: 25000, status: 'processing', createdAt: new Date(2026, 2, 24).toISOString() },
      { id: '3', type: 'minting', requester: 'Charlie', amount: 100000, status: 'completed', createdAt: new Date(2026, 2, 23).toISOString() },
      { id: '4', type: 'redeem', requester: 'Diana', amount: 15000, status: 'completed', createdAt: new Date(2026, 2, 22).toISOString() },
      { id: '5', type: 'minting', requester: 'Eve', amount: 75000, status: 'under_review', createdAt: new Date(2026, 2, 21).toISOString() },
    ],
  }
}
