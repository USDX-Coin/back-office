import type { MintingRequest, RedeemRequest, DashboardStats, MintingStatus, RedeemStatus } from '@/lib/types'

// Realistic name pool — mixed Indonesian & international
const NAMES = [
  'Budi Santoso', 'Siti Rahayu', 'Ahmad Fauzi', 'Dewi Kusuma', 'Rizky Pratama',
  'Nurul Hidayah', 'Andi Wijaya', 'Fitri Handayani', 'Hendra Gunawan', 'Maya Sari',
  'Dani Setiawan', 'Rini Oktavia', 'Agus Hermawan', 'Lina Wulandari', 'Fajar Nugroho',
  'Ayu Permata', 'Wahyu Saputra', 'Eka Putri', 'Bayu Setiawan', 'Indah Kurniawati',
  'James Thornton', 'Sarah Mitchell', 'David Chen', 'Rachel Nguyen', 'Michael Torres',
  'Emily Watson', 'Kevin Park', 'Sophia Liu', 'Daniel Kim', 'Amanda Johnson',
]

const EMAILS: Record<string, string> = {
  'Budi Santoso': 'budi.santoso@gmail.com',
  'Siti Rahayu': 'siti.rahayu@yahoo.com',
  'Ahmad Fauzi': 'ahmad.fauzi@outlook.com',
  'Dewi Kusuma': 'dewikusuma@gmail.com',
  'Rizky Pratama': 'rizky.pratama@gmail.com',
  'Nurul Hidayah': 'nurulhidayah@hotmail.com',
  'Andi Wijaya': 'andi.wijaya@gmail.com',
  'Fitri Handayani': 'fitrihandayani@yahoo.com',
  'Hendra Gunawan': 'hendra.g@gmail.com',
  'Maya Sari': 'maya.sari@gmail.com',
  'Dani Setiawan': 'dani.setiawan@outlook.com',
  'Rini Oktavia': 'rini.oktavia@gmail.com',
  'Agus Hermawan': 'agushermawan@gmail.com',
  'Lina Wulandari': 'lina.wulandari@yahoo.com',
  'Fajar Nugroho': 'fajar.nugroho@gmail.com',
  'Ayu Permata': 'ayupermata@gmail.com',
  'Wahyu Saputra': 'wahyu.saputra@outlook.com',
  'Eka Putri': 'eka.putri@gmail.com',
  'Bayu Setiawan': 'bayu.setiawan@gmail.com',
  'Indah Kurniawati': 'indah.kurniawati@yahoo.com',
  'James Thornton': 'j.thornton@company.com',
  'Sarah Mitchell': 'sarah.mitchell@fintech.io',
  'David Chen': 'd.chen@crypto.vc',
  'Rachel Nguyen': 'rachel.nguyen@fund.com',
  'Michael Torres': 'm.torres@investment.com',
  'Emily Watson': 'emily.watson@trading.com',
  'Kevin Park': 'kevin.park@capital.com',
  'Sophia Liu': 'sophia.liu@ventures.com',
  'Daniel Kim': 'daniel.kim@asset.com',
  'Amanda Johnson': 'a.johnson@hedge.com',
}

const BANKS = [
  'Bank Central Asia', 'Bank Rakyat Indonesia', 'Bank Mandiri',
  'Bank Negara Indonesia', 'CIMB Niaga', 'Bank Danamon', 'Bank Permata',
]

// Realistic amount pools (USD) — not linear
const MINTING_AMOUNTS = [
  12500, 25000, 50000, 75000, 100000, 150000, 200000, 250000,
  500000, 750000, 1000000, 37500, 62500, 87500, 125000,
]
const REDEEM_AMOUNTS = [
  8000, 15000, 22000, 35000, 50000, 75000, 100000, 150000,
  200000, 300000, 12500, 27500, 45000, 60000, 90000,
]

// Pseudo-random but deterministic seeded helpers
function seededPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed * 2654435761) % arr.length]
}

function seededHex(length: number, seed: number): string {
  let result = ''
  let s = seed
  while (result.length < length) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    result += Math.abs(s).toString(16).padStart(8, '0')
  }
  return result.slice(0, length)
}

function seededBankAccount(seed: number): string {
  let s = Math.abs(seed * 6364136223846793005)
  let result = ''
  for (let i = 0; i < 12; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    result += Math.abs(s) % 10
  }
  return result
}

// Generate a date going backwards from today within a 90-day window
function pastDate(dayOffset: number): string {
  const base = new Date('2026-03-28')
  base.setDate(base.getDate() - (dayOffset % 90))
  return base.toISOString()
}

let idCounter = 1

export function createMintingRequest(overrides: Partial<MintingRequest> = {}): MintingRequest {
  const id = String(idCounter++)
  const n = Number(id)
  const name = seededPick(NAMES, n)
  const amount = seededPick(MINTING_AMOUNTS, n + 7)
  const fee = Math.round(amount * 0.001)
  return {
    id,
    requester: name,
    email: EMAILS[name] ?? `${name.toLowerCase().replace(' ', '.')}@gmail.com`,
    amount,
    tokenType: 'USDX',
    bankAccount: seededBankAccount(n),
    walletAddress: `0x${seededHex(40, n + 100)}`,
    transactionHash: `0x${seededHex(64, n + 200)}`,
    fee,
    network: n % 5 === 0 ? 'Polygon' : n % 3 === 0 ? 'BNB Chain' : 'Ethereum',
    proofOfTransfer: `https://etherscan.io/tx/0x${seededHex(64, n + 300)}`,
    notes: '',
    status: 'pending',
    createdAt: pastDate(n * 3 + 1),
    updatedAt: pastDate(n * 3),
    ...overrides,
  }
}

export function createRedeemRequest(overrides: Partial<RedeemRequest> = {}): RedeemRequest {
  const id = String(idCounter++)
  const n = Number(id)
  const name = seededPick(NAMES, n + 15)
  const amount = seededPick(REDEEM_AMOUNTS, n + 13)
  const fee = Math.round(amount * 0.0008)
  return {
    id,
    requester: name,
    amount,
    bankAccount: seededBankAccount(n + 50),
    bankName: seededPick(BANKS, n),
    walletAddress: `0x${seededHex(40, n + 400)}`,
    transactionHash: `0x${seededHex(64, n + 500)}`,
    fee,
    network: n % 4 === 0 ? 'Polygon' : 'Ethereum',
    notes: '',
    status: 'pending',
    createdAt: pastDate(n * 2 + 5),
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
      total: 412,
      byStatus: {
        pending: 38,
        under_review: 27,
        approved: 64,
        rejected: 18,
        processing: 45,
        completed: 213,
        failed: 7,
      },
      totalVolume: 4215000,
    },
    redeem: {
      total: 287,
      byStatus: {
        pending: 22,
        processing: 41,
        completed: 218,
        failed: 6,
      },
      totalVolume: 2148000,
    },
    recentActivity: [
      { id: '1', type: 'minting', requester: 'Budi Santoso', amount: 250000, status: 'pending', createdAt: pastDate(0) },
      { id: '2', type: 'redeem', requester: 'Sarah Mitchell', amount: 150000, status: 'processing', createdAt: pastDate(1) },
      { id: '3', type: 'minting', requester: 'Rizky Pratama', amount: 500000, status: 'under_review', createdAt: pastDate(2) },
      { id: '4', type: 'redeem', requester: 'David Chen', amount: 75000, status: 'completed', createdAt: pastDate(3) },
      { id: '5', type: 'minting', requester: 'Dewi Kusuma', amount: 100000, status: 'completed', createdAt: pastDate(4) },
      { id: '6', type: 'redeem', requester: 'Ahmad Fauzi', amount: 35000, status: 'pending', createdAt: pastDate(5) },
      { id: '7', type: 'minting', requester: 'Rachel Nguyen', amount: 1000000, status: 'processing', createdAt: pastDate(6) },
      { id: '8', type: 'redeem', requester: 'Andi Wijaya', amount: 50000, status: 'completed', createdAt: pastDate(7) },
      { id: '9', type: 'minting', requester: 'Maya Sari', amount: 200000, status: 'approved', createdAt: pastDate(8) },
      { id: '10', type: 'redeem', requester: 'James Thornton', amount: 300000, status: 'completed', createdAt: pastDate(9) },
    ],
  }
}
