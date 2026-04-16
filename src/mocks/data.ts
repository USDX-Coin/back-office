import type {
  MintingRequest,
  RedeemRequest,
  DashboardStats,
  MintingStatus,
  RedeemStatus,
  Customer,
  CustomerRole,
  CustomerType,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  Network,
  DashboardSnapshot,
  ReportRow,
  CustomerSummary,
  StaffSummary,
  ReportInsights,
} from '@/lib/types'

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
  let s = Math.abs(seed * 2654435761) & 0xffffffff
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

// ─────────────────────────────────────────────────────────────────────────────
// Azure Horizon redesign factories (Customer / Staff / OTC)
// ─────────────────────────────────────────────────────────────────────────────

const CUSTOMER_NAMES = [
  'Julian Anderson', 'Sarah Mitchell', 'Robert Deon', 'Maria Sanchez', 'David Chen',
  'Emily Watson', 'Kevin Park', 'Sophia Liu', 'Daniel Kim', 'Amanda Johnson',
  'Bruce Wayne', 'Diana Prince', 'Clark Kent', 'Selina Kyle', 'Barry Allen',
  'Hal Jordan', 'Arthur Curry', 'Victor Stone', 'Jane Doe', 'John Smith',
  'Marcus Smith', 'Sarah Connor', 'Linda Chen', 'Marcus Aurelius', 'Sarah King',
  'Aisha Nakamura', 'Tariq Hassan', 'Olga Petrov', 'Yuki Tanaka', 'Lucas Silva',
]

const STAFF_NAMES = [
  { firstName: 'Demo', lastName: 'Operator', role: 'super_admin' as const, email: 'demo@usdx.io' },
  { firstName: 'Marcus', lastName: 'Thorne', role: 'super_admin' as const, email: 'marcus.t@usdx.io' },
  { firstName: 'Linda', lastName: 'Chen', role: 'operations' as const, email: 'linda.c@usdx.io' },
  { firstName: 'Marcus', lastName: 'Aurelius', role: 'compliance' as const, email: 'marcus.a@usdx.io' },
  { firstName: 'Sarah', lastName: 'King', role: 'support' as const, email: 'sking@usdx.io' },
  { firstName: 'James', lastName: 'Reed', role: 'operations' as const, email: 'j.reed@usdx.io' },
  { firstName: 'Priya', lastName: 'Khan', role: 'compliance' as const, email: 'p.khan@usdx.io' },
  { firstName: 'Tom', lastName: 'Walters', role: 'support' as const, email: 't.walters@usdx.io' },
]

const ORGANIZATIONS = [
  'Vertex Solutions', 'Nexus Logistics', 'Apex Capital', 'Quantum Holdings',
  'Stellar Ventures', 'Polaris Trading', 'Helios Asset Mgmt', 'Orion Funds',
  'Atlas Treasury', 'Phoenix Partners',
]

const NETWORKS: Network[] = ['ethereum', 'polygon', 'arbitrum', 'solana', 'base']

const OTC_AMOUNTS_MINT = [25_000, 50_000, 75_000, 100_000, 125_000, 250_000, 500_000, 1_000_000, 1_500_000]
const OTC_AMOUNTS_REDEEM = [8_000, 15_000, 22_000, 35_000, 50_000, 75_000, 100_000, 150_000, 250_000]

function pastDateRecent(dayOffset: number): string {
  const base = new Date()
  base.setUTCDate(base.getUTCDate() - dayOffset)
  base.setUTCHours(12 - (dayOffset % 12), 0, 0, 0)
  return base.toISOString()
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return [parts[0]!, '']
  return [parts[0]!, parts.slice(1).join(' ')]
}

function customerEmail(first: string, last: string, n: number): string {
  const domain = ['gmail.com', 'outlook.com', 'example.com', 'fintech.io', 'ventures.com'][n % 5]
  return `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`.replace(/\s/g, '')
}

let customerIdCounter = 1
let staffIdCounter = 1
let txIdCounter = 1

export function createCustomer(overrides: Partial<Customer> = {}): Customer {
  const id = `cus_${customerIdCounter++}`
  const n = customerIdCounter
  const fullName = CUSTOMER_NAMES[(n - 1) % CUSTOMER_NAMES.length]!
  const [firstName, lastName] = splitName(fullName)
  const type: CustomerType = n % 3 === 0 ? 'personal' : 'organization'
  const role: CustomerRole = (['admin', 'editor', 'member'] as const)[n % 3]!
  return {
    id,
    firstName,
    lastName,
    email: customerEmail(firstName, lastName, n),
    phone: `+1${seededBankAccount(n).slice(0, 10)}`,
    type,
    organization: type === 'organization' ? ORGANIZATIONS[n % ORGANIZATIONS.length]! : undefined,
    role,
    createdAt: pastDateRecent((n * 3) % 90),
    ...overrides,
  }
}

export function createStaff(overrides: Partial<Staff> = {}): Staff {
  const id = `stf_${staffIdCounter++}`
  const n = staffIdCounter
  const seed = STAFF_NAMES[(n - 1) % STAFF_NAMES.length]!
  return {
    id,
    firstName: seed.firstName,
    lastName: seed.lastName,
    email: seed.email,
    phone: `+1${seededBankAccount(n + 200).slice(0, 10)}`,
    role: seed.role,
    displayName: `${seed.firstName} ${seed.lastName}`,
    createdAt: pastDateRecent((n * 5) % 60),
    ...overrides,
  }
}

function pickStatus(seed: number): OtcStatus {
  const mod = seed % 10
  if (mod === 0) return 'failed'
  if (mod < 3) return 'pending'
  return 'completed'
}

export function createOtcMintTransaction(
  customer: Customer,
  operator: Staff,
  overrides: Partial<OtcMintTransaction> = {}
): OtcMintTransaction {
  const id = `otc_mint_${txIdCounter++}`
  const n = txIdCounter
  const status = pickStatus(n)
  const createdAt = pastDateRecent(n % 60)
  return {
    id,
    txHash: `0x${seededHex(64, n + 1000)}`,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`.trim(),
    operatorStaffId: operator.id,
    operatorName: operator.displayName,
    network: NETWORKS[n % NETWORKS.length]!,
    amount: OTC_AMOUNTS_MINT[n % OTC_AMOUNTS_MINT.length]!,
    destinationAddress: `0x${seededHex(40, n + 2000)}`,
    notes: '',
    status,
    createdAt,
    settledAt: status === 'completed' || status === 'failed' ? createdAt : undefined,
    ...overrides,
  }
}

export function createOtcRedeemTransaction(
  customer: Customer,
  operator: Staff,
  overrides: Partial<OtcRedeemTransaction> = {}
): OtcRedeemTransaction {
  const id = `otc_rdm_${txIdCounter++}`
  const n = txIdCounter
  const status = pickStatus(n + 5)
  const createdAt = pastDateRecent(n % 60)
  return {
    id,
    txHash: `0x${seededHex(64, n + 3000)}`,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`.trim(),
    operatorStaffId: operator.id,
    operatorName: operator.displayName,
    network: NETWORKS[n % NETWORKS.length]!,
    amount: OTC_AMOUNTS_REDEEM[n % OTC_AMOUNTS_REDEEM.length]!,
    status,
    createdAt,
    settledAt: status === 'completed' || status === 'failed' ? createdAt : undefined,
    ...overrides,
  }
}

export function createMockCustomerList(count = 30): Customer[] {
  customerIdCounter = 1
  return Array.from({ length: count }, () => createCustomer())
}

export function createMockStaffList(): Staff[] {
  staffIdCounter = 1
  return STAFF_NAMES.map(() => createStaff())
}

export function createMockOtcTransactions(
  customers: Customer[],
  staff: Staff[],
  mintCount = 120,
  redeemCount = 80
): { mints: OtcMintTransaction[]; redeems: OtcRedeemTransaction[] } {
  txIdCounter = 1
  const mints = Array.from({ length: mintCount }, (_, i) =>
    createOtcMintTransaction(customers[i % customers.length]!, staff[i % staff.length]!)
  )
  const redeems = Array.from({ length: redeemCount }, (_, i) =>
    createOtcRedeemTransaction(customers[(i + 7) % customers.length]!, staff[(i + 1) % staff.length]!)
  )
  return { mints, redeems }
}

// ─── Derived computations (consumed by handlers) ───

const THIRTY_DAYS_MS = 30 * 86_400_000

export function computeCustomerSummary(customers: Customer[]): CustomerSummary {
  return {
    total: customers.length,
    active: customers.length,
    organizations: new Set(customers.filter((c) => c.organization).map((c) => c.organization)).size,
  }
}

export function computeStaffSummary(staff: Staff[]): StaffSummary {
  return {
    total: staff.length,
    admins: staff.filter((s) => s.role === 'super_admin').length,
    activeNow: staff.length,
  }
}

function txToReportRow(
  tx: OtcMintTransaction | OtcRedeemTransaction,
  kind: 'mint' | 'redeem'
): ReportRow {
  return {
    id: tx.id,
    kind,
    txHash: tx.txHash,
    customerId: tx.customerId,
    customerName: tx.customerName,
    network: tx.network,
    amount: tx.amount,
    status: tx.status,
    createdAt: tx.createdAt,
  }
}

export function computeReportRows(
  mints: OtcMintTransaction[],
  redeems: OtcRedeemTransaction[]
): ReportRow[] {
  const rows: ReportRow[] = [
    ...mints.map((t) => txToReportRow(t, 'mint')),
    ...redeems.map((t) => txToReportRow(t, 'redeem')),
  ]
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function computeReportInsights(rows: ReportRow[]): ReportInsights {
  const completed = rows.filter((r) => r.status === 'completed')
  const totalVolume = completed.reduce((sum, r) => sum + r.amount, 0)
  const activeMinters = new Set(rows.filter((r) => r.kind === 'mint').map((r) => r.customerId)).size
  const flagged = rows.filter((r) => r.status === 'failed').length
  return {
    totalVolume,
    activeMinters,
    flagged,
    trends: {
      volume: { direction: 'up', percentChange: 12.5 },
      minters: { direction: 'up', percentChange: 4.2 },
    },
  }
}

export function computeDashboardSnapshot(
  customers: Customer[],
  mints: OtcMintTransaction[],
  redeems: OtcRedeemTransaction[]
): DashboardSnapshot {
  const now = Date.now()
  const cutoff = now - THIRTY_DAYS_MS

  const recent = [...mints, ...redeems].filter((tx) => new Date(tx.createdAt).getTime() >= cutoff)
  const recentMints = recent.filter((tx): tx is OtcMintTransaction => 'destinationAddress' in tx)
  const recentRedeems = recent.filter((tx): tx is OtcRedeemTransaction => !('destinationAddress' in tx))

  const totalMintVolume30d = recentMints
    .filter((t) => t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0)
  const totalRedeemVolume30d = recentRedeems
    .filter((t) => t.status === 'completed')
    .reduce((s, t) => s + t.amount, 0)
  const pendingTransactions = recent.filter((t) => t.status === 'pending').length

  // 30-day daily trend (zero-fill)
  const trendByDay = new Map<string, { mint: number; redeem: number }>()
  for (let d = 29; d >= 0; d--) {
    const dt = new Date(now - d * 86_400_000)
    const key = dt.toISOString().slice(0, 10)
    trendByDay.set(key, { mint: 0, redeem: 0 })
  }
  for (const tx of recentMints) {
    const key = tx.createdAt.slice(0, 10)
    const slot = trendByDay.get(key)
    if (slot && tx.status === 'completed') slot.mint += tx.amount
  }
  for (const tx of recentRedeems) {
    const key = tx.createdAt.slice(0, 10)
    const slot = trendByDay.get(key)
    if (slot && tx.status === 'completed') slot.redeem += tx.amount
  }

  const allTxs = [...mints, ...redeems].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const recentActivity: ReportRow[] = allTxs
    .slice(0, 8)
    .map((tx) =>
      'destinationAddress' in tx
        ? txToReportRow(tx, 'mint')
        : txToReportRow(tx, 'redeem')
    )

  const networkCounts = new Map<Network, number>()
  for (const tx of recent) {
    networkCounts.set(tx.network, (networkCounts.get(tx.network) ?? 0) + 1)
  }
  const totalNetworkTx = Array.from(networkCounts.values()).reduce((a, b) => a + b, 0) || 1
  const networkDistribution = Array.from(networkCounts.entries())
    .map(([network, count]) => ({
      network,
      count,
      share: Math.round((count / totalNetworkTx) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    kpis: {
      totalMintVolume30d,
      totalRedeemVolume30d,
      activeUsers: customers.length,
      pendingTransactions,
      trends: {
        mintVolume: { direction: 'up', percentChange: 12.5 },
        redeemVolume: { direction: 'up', percentChange: 4.2 },
        activeUsers: { direction: 'up', percentChange: 8.1 },
      },
    },
    volumeTrend: Array.from(trendByDay.entries()).map(([date, v]) => ({
      date,
      mint: v.mint,
      redeem: v.redeem,
    })),
    recentActivity,
    networkDistribution,
  }
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
