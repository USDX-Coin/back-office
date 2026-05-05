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
  StaffSummary,
  ReportInsights,
  RequestChain,
  RequestDetail,
  RequestListItem,
  RequestStatus,
  RequestType,
  SafeType,
  MintRequestDetail,
  BurnRequestDetail,
  MintRequestStatus,
  BurnRequestStatus,
  PhaseOneUser,
  PhaseOneUserWallet,
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — mint/burn request factories (matches sot/openapi.yaml)
// ─────────────────────────────────────────────────────────────────────────────

const REQUEST_CHAINS: RequestChain[] = ['ethereum', 'polygon', 'arbitrum', 'base']
const SAFE_TYPES: SafeType[] = ['STAFF', 'MANAGER']
const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Permata']

const MINT_STATUSES: MintRequestStatus[] = [
  'PENDING_APPROVAL',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTED',
  'EXECUTED',
  'EXECUTED',
  'REJECTED',
]
const BURN_STATUSES: BurnRequestStatus[] = [
  'PENDING_APPROVAL',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTED',
  'IDR_TRANSFERRED',
  'IDR_TRANSFERRED',
  'REJECTED',
]

const RATE_USED = '16250'

let requestIdCounter = 1

function uuidLike(seed: number, prefix = ''): string {
  const hex = seededHex(32, seed)
  return `${prefix}${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function bytes32(seed: number): string {
  return `0x${seededHex(64, seed)}`
}

function bytes20(seed: number): string {
  return `0x${seededHex(40, seed)}`
}

function decimalAmount(seed: number, type: RequestType): string {
  const base = type === 'mint'
    ? [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000]
    : [500, 2_500, 7_500, 15_000, 35_000, 75_000, 150_000, 300_000]
  const whole = base[seed % base.length]!
  const cents = (seed * 37) % 100
  return `${whole}.${cents.toString().padStart(2, '0')}`
}

function decimalIdr(amount: string): string {
  const usd = Number.parseFloat(amount)
  const idr = Math.round(usd * Number.parseFloat(RATE_USED))
  return idr.toString()
}

function amountWei(amount: string): string {
  // sot/conventions.md L30: USDX uses 6 decimals (like USDC/USDT).
  //   1 USDX = 1_000_000 wei
  //   "100.50" → "100500000"
  const [whole, fraction = ''] = amount.split('.')
  const padded = (fraction + '000000').slice(0, 6)
  return (BigInt(whole + padded)).toString()
}

interface CreateRequestOpts {
  type: RequestType
  user: Customer
  createdBy: Staff
}

function createRequestPair(opts: CreateRequestOpts, seed: number): {
  list: RequestListItem
  detail: RequestDetail
} {
  const id = uuidLike(seed + 9000)
  const idempotencyKey = bytes32(seed + 11000)
  const userAddress = bytes20(seed + 13000)
  const amount = decimalAmount(seed, opts.type)
  const amountIdrValue = decimalIdr(amount)
  const amountWeiValue = amountWei(amount)
  const chain = REQUEST_CHAINS[seed % REQUEST_CHAINS.length]!
  const safeType = SAFE_TYPES[seed % SAFE_TYPES.length]!
  const status: RequestStatus =
    opts.type === 'mint'
      ? MINT_STATUSES[seed % MINT_STATUSES.length]!
      : BURN_STATUSES[seed % BURN_STATUSES.length]!
  const createdAt = pastDateRecent(seed % 60)
  const updatedAt = createdAt
  const userName = `${opts.user.firstName} ${opts.user.lastName}`.trim()
  const isExecutedOrLater =
    status === 'EXECUTED' || status === 'IDR_TRANSFERRED'
  const safeTxHash = status !== 'PENDING_APPROVAL' ? bytes32(seed + 15000) : null
  const onChainTxHash = isExecutedOrLater ? bytes32(seed + 17000) : null

  const list: RequestListItem = {
    id,
    type: opts.type,
    userId: opts.user.id,
    userName,
    userAddress,
    amount,
    amountIdr: amountIdrValue,
    chain,
    safeType,
    status,
    createdBy: opts.createdBy.id,
    createdAt,
  }

  const base = {
    id,
    idempotencyKey,
    userId: opts.user.id,
    userName,
    userAddress,
    amount,
    amountWei: amountWeiValue,
    amountIdr: amountIdrValue,
    rateUsed: RATE_USED,
    chain,
    notes: seed % 4 === 0 ? null : `Reference #${seed}`,
    safeType,
    safeTxHash,
    onChainTxHash,
    createdBy: opts.createdBy.id,
    createdAt,
    updatedAt,
  } satisfies Omit<MintRequestDetail | BurnRequestDetail, 'type' | 'status' | 'depositTxHash' | 'bankName' | 'bankAccount'>

  const detail: RequestDetail =
    opts.type === 'mint'
      ? { ...base, type: 'mint', status: status as MintRequestStatus }
      : {
          ...base,
          type: 'burn',
          status: status as BurnRequestStatus,
          depositTxHash: bytes32(seed + 19000),
          bankName: BANKS[seed % BANKS.length]!,
          bankAccount: seededBankAccount(seed + 21000).slice(0, 10),
        }

  return { list, detail }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — user directory derived from existing Customer store.
// Customers carry first/last name; Phase-1 User has a single `name` field
// plus on-chain wallets. We synthesize one wallet per Customer (deterministic).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase-1 IDR threshold for the Safe split.
 * sot/phase-1.md L52-55: amounts ≥ this go to the Manager Safe; below to Staff.
 * The role-vs-amount gate is intentionally not enforced in the mock (see
 * /api/v1/mint handler comment) — backend will be authoritative.
 */
export const MANAGER_THRESHOLD_IDR = 1_000_000_000

/**
 * Build a Phase-1 mint request pair (list item + detail) from a submission.
 * Uses the latest counter seed so freshly created requests get unique ids.
 */
export function createMintFromRequest(
  user: { id: string; name: string },
  createdBy: Staff,
  body: { userAddress: string; amount: string; chain: string; notes?: string },
  amountIdrValue: number,
  safeType: SafeType
): { list: RequestListItem; detail: MintRequestDetail } {
  const seed = ++requestIdCounter + 100_000
  const id = uuidLike(seed + 9000)
  const idempotencyKey = bytes32(seed + 11000)
  const createdAt = new Date().toISOString()
  const list: RequestListItem = {
    id,
    type: 'mint',
    userId: user.id,
    userName: user.name,
    userAddress: body.userAddress,
    amount: body.amount,
    amountIdr: amountIdrValue.toString(),
    chain: body.chain as RequestChain,
    safeType,
    status: 'PENDING_APPROVAL',
    createdBy: createdBy.id,
    createdAt,
  }
  const detail: MintRequestDetail = {
    id,
    type: 'mint',
    idempotencyKey,
    userId: user.id,
    userName: user.name,
    userAddress: body.userAddress,
    amount: body.amount,
    amountWei: amountWei(body.amount),
    amountIdr: amountIdrValue.toString(),
    rateUsed: RATE_USED,
    chain: body.chain as RequestChain,
    notes: body.notes && body.notes.length > 0 ? body.notes : null,
    safeType,
    status: 'PENDING_APPROVAL',
    safeTxHash: null,
    onChainTxHash: null,
    createdBy: createdBy.id,
    createdAt,
    updatedAt: createdAt,
  }
  return { list, detail }
}

export function customerToPhaseOneUser(customer: Customer, seed: number): PhaseOneUser {
  const fullName = `${customer.firstName} ${customer.lastName}`.trim()
  const wallet: PhaseOneUserWallet = {
    id: uuidLike(seed + 23000),
    chain: REQUEST_CHAINS[seed % REQUEST_CHAINS.length]!,
    address: bytes20(seed + 25000),
    createdAt: customer.createdAt,
  }
  return {
    id: customer.id,
    name: fullName,
    notes: customer.organization ?? null,
    wallets: [wallet],
    createdAt: customer.createdAt,
    updatedAt: customer.createdAt,
  }
}

export function createMockRequests(
  customers: Customer[],
  staff: Staff[],
  count = 64
): { list: RequestListItem[]; details: Map<string, RequestDetail> } {
  requestIdCounter = 1
  const list: RequestListItem[] = []
  const details = new Map<string, RequestDetail>()
  if (customers.length === 0 || staff.length === 0) return { list, details }
  for (let i = 0; i < count; i++) {
    const seed = requestIdCounter++
    const type: RequestType = i % 3 === 0 ? 'burn' : 'mint'
    const user = customers[i % customers.length]!
    const createdBy = staff[i % staff.length]!
    const pair = createRequestPair({ type, user, createdBy }, seed)
    list.push(pair.list)
    details.set(pair.list.id, pair.detail)
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return { list, details }
}

// ─────────────────────────────────────────────────────────────────────────────
// Burn submission factory — used by POST /api/v1/burn handler.
// Persists to the same requestList + details store so /requests reflects it.
// ─────────────────────────────────────────────────────────────────────────────

interface BurnSubmissionInput {
  userName: string
  userAddress: string
  amount: string
  chain: RequestChain
  depositTxHash: string
  bankName: string
  bankAccount: string
  notes?: string
}

export function createBurnRequestFromSubmission(
  input: BurnSubmissionInput,
  createdBy: Staff,
  matchedUser?: Customer
): { list: RequestListItem; detail: BurnRequestDetail } {
  const seed = requestIdCounter++ + 50_000
  const id = uuidLike(seed)
  const idempotencyKey = bytes32(seed + 100)
  const amountIdrValue = decimalIdr(input.amount)
  const amountWeiValue = amountWei(input.amount)
  // Per sot/phase-1.md flow: backend computes IDR, checks role vs threshold,
  // then routes to STAFF or MANAGER Safe. Mock heuristic: route to MANAGER
  // when amountIDR is at or above 1B (approximate threshold from phase-1.md).
  const safeType: SafeType =
    Number(amountIdrValue) >= 1_000_000_000 ? 'MANAGER' : 'STAFF'
  const createdAt = new Date().toISOString()
  const userId = matchedUser?.id ?? `usr_burn_${seed}`

  const list: RequestListItem = {
    id,
    type: 'burn',
    userId,
    userName: input.userName.trim(),
    userAddress: input.userAddress.trim(),
    amount: input.amount,
    amountIdr: amountIdrValue,
    chain: input.chain,
    safeType,
    status: 'PENDING_APPROVAL',
    createdBy: createdBy.id,
    createdAt,
  }

  const detail: BurnRequestDetail = {
    id,
    type: 'burn',
    status: 'PENDING_APPROVAL',
    idempotencyKey,
    userId,
    userName: input.userName.trim(),
    userAddress: input.userAddress.trim(),
    amount: input.amount,
    amountWei: amountWeiValue,
    amountIdr: amountIdrValue,
    rateUsed: RATE_USED,
    chain: input.chain,
    notes: input.notes && input.notes.trim() ? input.notes.trim() : null,
    safeType,
    safeTxHash: null,
    onChainTxHash: null,
    depositTxHash: input.depositTxHash.trim(),
    bankName: input.bankName.trim(),
    bankAccount: input.bankAccount.trim(),
    createdBy: createdBy.id,
    createdAt,
    updatedAt: createdAt,
  }

  return { list, detail }
}

