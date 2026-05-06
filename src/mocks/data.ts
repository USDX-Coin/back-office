import type {
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
} from '@/lib/types'

// Pseudo-random but deterministic seeded helpers
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

// ─────────────────────────────────────────────────────────────────────────────
// Azure Horizon factories (Customer / Staff / OTC)
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
  { name: 'Demo Operator', role: 'ADMIN' as const, email: 'demo@usdx.io' },
  { name: 'Marcus Thorne', role: 'ADMIN' as const, email: 'marcus.t@usdx.io' },
  { name: 'Linda Chen', role: 'MANAGER' as const, email: 'linda.c@usdx.io' },
  { name: 'Marcus Aurelius', role: 'DEVELOPER' as const, email: 'marcus.a@usdx.io' },
  { name: 'Sarah King', role: 'STAFF' as const, email: 'sking@usdx.io' },
  { name: 'James Reed', role: 'MANAGER' as const, email: 'j.reed@usdx.io' },
  { name: 'Priya Khan', role: 'DEVELOPER' as const, email: 'p.khan@usdx.io' },
  { name: 'Tom Walters', role: 'STAFF' as const, email: 't.walters@usdx.io' },
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
  const created = pastDateRecent((n * 5) % 60)
  return {
    id,
    name: seed.name,
    email: seed.email,
    role: seed.role,
    isActive: true,
    createdAt: created,
    updatedAt: created,
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
    operatorName: operator.name,
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
    operatorName: operator.name,
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

