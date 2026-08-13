import type {
  AmountCurrency,
  Customer,
  CustomerRole,
  CustomerType,
  EntityType,
  KycDetail,
  KycListItem,
  KycReviewLog,
  KycStatus,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  Network,
  DashboardStats,
  ReportRow,
  CustomerSummary,
  StaffSummary,
  RateConfig,
  RateInfo,
  FeeConfig,
  ReserveLedgerEntry,
  AttestationReport,
  UserAnalytics,
  UserWallet,
  ChainConfig,
  RequestChain,
  RequestDetail,
  RequestListItem,
  RequestStatus,
  RequestType,
  SafeType,
  OncallContact,
  CreateOncallContact,
  MintRequestDetail,
  BurnRequestDetail,
  MintRequestStatus,
  BurnRequestStatus,
  PhaseOneUser,
  PhaseOneUserWallet,
  OrderListItem,
  OrderDetail,
  MintPaymentStatus,
  MintSafeStatus,
  MintOrderStatus,
  RedeemStatus,
  PaymentChannel,
  VaBank,
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
let walletIdCounter = 1

export function createUserWallet(overrides: Partial<UserWallet> = {}): UserWallet {
  const id = `wal_${walletIdCounter++}`
  const n = walletIdCounter
  return {
    id,
    chain: NETWORKS[n % NETWORKS.length]!,
    address: `0x${seededHex(40, n + 5000)}`,
    createdAt: pastDateRecent((n * 2) % 60),
    ...overrides,
  }
}

export function createCustomer(overrides: Partial<Customer> = {}): Customer {
  const id = `cus_${customerIdCounter++}`
  const n = customerIdCounter
  const fullName = CUSTOMER_NAMES[(n - 1) % CUSTOMER_NAMES.length]!
  const [firstName, lastName] = splitName(fullName)
  const type: CustomerType = n % 3 === 0 ? 'personal' : 'organization'
  const role: CustomerRole = (['admin', 'editor', 'member'] as const)[n % 3]!
  const walletCount = (n % 3) + 1
  const wallets: UserWallet[] = Array.from({ length: walletCount }, () => createUserWallet())
  return {
    id,
    firstName,
    lastName,
    email: customerEmail(firstName, lastName, n),
    phone: `+1${seededBankAccount(n).slice(0, 10)}`,
    type,
    organization: type === 'organization' ? ORGANIZATIONS[n % ORGANIZATIONS.length]! : undefined,
    role,
    notes: undefined,
    wallets,
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
  walletIdCounter = 1
  return Array.from({ length: count }, () => createCustomer())
}

export function computeUserAnalytics(
  customerId: string,
  mints: OtcMintTransaction[],
  redeems: OtcRedeemTransaction[]
): UserAnalytics {
  const userMints = mints.filter((m) => m.customerId === customerId && m.status === 'completed')
  const userRedeems = redeems.filter((r) => r.customerId === customerId && r.status === 'completed')
  const totalMinted = userMints.reduce((sum, m) => sum + m.amount, 0)
  const totalBurned = userRedeems.reduce((sum, r) => sum + r.amount, 0)
  const totalTransactions =
    mints.filter((m) => m.customerId === customerId).length +
    redeems.filter((r) => r.customerId === customerId).length
  // sot/openapi.yaml § UserAnalytics — totalMinted/Burned are decimal strings.
  return {
    totalMinted: String(totalMinted),
    totalBurned: String(totalBurned),
    totalTransactions,
  }
}

export function computeUserRecentRequests(
  customerId: string,
  mints: OtcMintTransaction[],
  redeems: OtcRedeemTransaction[],
  limit = 5
): ReportRow[] {
  const all: ReportRow[] = [
    ...mints
      .filter((m) => m.customerId === customerId)
      .map((m) => txToReportRow(m, 'mint')),
    ...redeems
      .filter((r) => r.customerId === customerId)
      .map((r) => txToReportRow(r, 'redeem')),
  ]
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit)
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
    admins: staff.filter((s) => s.role === 'ADMIN').length,
    activeNow: staff.filter((s) => s.isActive).length,
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

// USDX-37: computeDashboardSnapshot removed — Dashboard now consumes the
// SoT /api/v1/dashboard/stats response (computeDashboardStats below).

// ─── Rate config (sot/openapi.yaml § /api/v1/rate) ───────────────────────────
//
// Append-only history per sot/phase-1.md § Rate Configuration: every update
// pushes a new entry, the latest entry is the active config. The seeded
// initial config matches the SoT example values (rate 16,250.00, spread 0.5%).

let rateIdCounter = 1
function nextRateId(): string {
  // Mock-only id generator. Backend uses UUID v7; shape is opaque to clients.
  return `rate-${(rateIdCounter++).toString().padStart(4, '0')}`
}

export function createRateConfig(overrides: Partial<RateConfig> = {}): RateConfig {
  return {
    id: nextRateId(),
    mode: 'DYNAMIC',
    manualRate: null,
    // USDX-207: spread directional — beli (mint) + jual (burn/redeem).
    spreadBuyPct: '0.5',
    spreadSellPct: '0.4',
    updatedBy: 'seed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createInitialRateHistory(seedStaffId: string): RateConfig[] {
  rateIdCounter = 1
  return [
    createRateConfig({
      mode: 'DYNAMIC',
      manualRate: null,
      spreadBuyPct: '0.5',
      spreadSellPct: '0.4',
      updatedBy: seedStaffId,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    }),
  ]
}

// Compute the rate the backend would surface to clients. For MANUAL we use
// manual_rate * (1 + spread/100); DYNAMIC mocks the third-party feed at a
// fixed value (16,200) and applies the same spread. The exact base is
// unimportant for FE — what matters is that GET returns a stable shape.
const MOCK_DYNAMIC_BASE_RATE = 16_200

export function computeRateInfo(history: RateConfig[]): RateInfo {
  const latest = history[history.length - 1]
  if (!latest) {
    return {
      baseRate: '0.00',
      mode: 'DYNAMIC',
      spreadBuyPct: '0',
      spreadSellPct: '0',
      effectiveBuyRate: '0.00',
      effectiveSellRate: '0.00',
      updatedAt: new Date().toISOString(),
    }
  }
  const buy = Number(latest.spreadBuyPct) || 0
  const sell = Number(latest.spreadSellPct) || 0
  const base =
    latest.mode === 'MANUAL' && latest.manualRate
      ? Number(latest.manualRate)
      : MOCK_DYNAMIC_BASE_RATE
  return {
    baseRate: base.toFixed(2),
    mode: latest.mode,
    spreadBuyPct: latest.spreadBuyPct,
    spreadSellPct: latest.spreadSellPct,
    // Beli: base × (1 + buy/100); Jual: base × (1 − sell/100).
    effectiveBuyRate: (base * (1 + buy / 100)).toFixed(2),
    effectiveSellRate: (base * (1 - sell / 100)).toFixed(2),
    updatedAt: latest.createdAt,
  }
}

// ─── Fee config (sot/api/fee.yaml § /api/v1/fee-config, USDX-207) ────────────
// Append-only, admin-set. Latest row = active config. Seed mirrors the W2
// reference tariffs (mint fee 1%, PG VA Rp4.000 flat, PG QRIS 0.7%).

let feeIdCounter = 1
function nextFeeId(): string {
  return `fee-${(feeIdCounter++).toString().padStart(4, '0')}`
}

export function createFeeConfig(overrides: Partial<FeeConfig> = {}): FeeConfig {
  return {
    id: nextFeeId(),
    mintFeePct: '1.0',
    pgFeeVaFlat: '4000.00',
    pgFeeQrisPct: '0.7',
    // Redeem fees (W3, USDX-245) — seeded so redeem orders compute; admin-set.
    redeemFeePct: '1.0',
    disbursementFeeFlat: '5000.00',
    updatedBy: 'seed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createInitialFeeHistory(seedStaffId: string): FeeConfig[] {
  feeIdCounter = 1
  return [
    createFeeConfig({
      updatedBy: seedStaffId,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    }),
  ]
}

// ─── Transparency (/api/v1/transparency/*) ───────────────────────────────────
// Shapes here are copied from catatan/KONTRAK-API-TRANSPARANSI.md § 3. The
// backend is being built in parallel against that same file, so these mocks
// exist to develop against the contract — NOT to define it. If a field name
// here drifts from the contract, every test that passes becomes a lie.
//
// The figures are deliberately arbitrary. Contract § 6 says the real seeding
// numbers (and the custodian, account number, NPWP) must never be written into
// any code — staff type them into production through the back office.

let ledgerIdCounter = 1
function nextLedgerId(): string {
  // Contract says uuid v7; the mock only needs a stable, unique, opaque id.
  return `0198a000-0000-7000-8000-${(ledgerIdCounter++).toString().padStart(12, '0')}`
}

let attestationIdCounter = 1
function nextAttestationId(): string {
  return `0198b000-0000-7000-8000-${(attestationIdCounter++).toString().padStart(12, '0')}`
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function dateOnlyDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10)
}

export function createLedgerEntry(
  overrides: Partial<ReserveLedgerEntry> = {}
): ReserveLedgerEntry {
  return {
    id: nextLedgerId(),
    entryType: 'ADJUSTMENT',
    amount: '1000.00',
    currency: 'USD',
    reason: 'Penyesuaian saldo hasil rekonsiliasi bulanan',
    occurredAt: dateOnlyDaysAgo(1),
    createdByName: 'Demo Admin',
    createdAt: isoDaysAgo(1),
    ...overrides,
  }
}

/**
 * Seed ledger: one SEED plus two ADJUSTMENTs, one of which is NEGATIVE — the
 * contract's only way to correct a figure — so the table and the balance are
 * exercised against a sign change from the first render.
 */
export function createInitialLedgerEntries(): ReserveLedgerEntry[] {
  ledgerIdCounter = 1
  return [
    createLedgerEntry({
      entryType: 'SEED',
      amount: '50000.00',
      reason: 'Setoran awal cadangan ke rekening kustodian',
      occurredAt: dateOnlyDaysAgo(45),
      createdAt: isoDaysAgo(45),
    }),
    createLedgerEntry({
      entryType: 'ADJUSTMENT',
      amount: '2500.50',
      reason: 'Tambahan setoran cadangan periode berjalan',
      occurredAt: dateOnlyDaysAgo(20),
      createdAt: isoDaysAgo(20),
    }),
    createLedgerEntry({
      entryType: 'ADJUSTMENT',
      amount: '-1250.75',
      reason: 'Koreksi pencatatan ganda pada setoran sebelumnya',
      occurredAt: dateOnlyDaysAgo(5),
      createdByName: 'Demo Admin',
      createdAt: isoDaysAgo(5),
    }),
  ]
}

export function createAttestationReport(
  overrides: Partial<AttestationReport> = {}
): AttestationReport {
  return {
    id: nextAttestationId(),
    period: '2026-06',
    title: 'Laporan Atestasi Cadangan Juni 2026',
    fileUrl: 'https://storage.usdx.test/transparency/attestation/atestasi-2026-06.pdf',
    publishedAt: isoDaysAgo(30),
    revokedAt: null,
    ...overrides,
  }
}

/**
 * Seed attestations include one REVOKED row on purpose. The backend returns
 * revoked reports for the audit trail, so the mock must too — otherwise the
 * back office's obligation to filter them out is never actually tested.
 */
export function createInitialAttestations(): AttestationReport[] {
  attestationIdCounter = 1
  return [
    createAttestationReport({
      period: '2026-04',
      title: 'Laporan Atestasi Cadangan April 2026 (ditarik)',
      fileUrl: 'https://storage.usdx.test/transparency/attestation/atestasi-2026-04.pdf',
      publishedAt: isoDaysAgo(92),
      revokedAt: isoDaysAgo(80),
    }),
    createAttestationReport({
      period: '2026-05',
      title: 'Laporan Atestasi Cadangan Mei 2026',
      fileUrl: 'https://storage.usdx.test/transparency/attestation/atestasi-2026-05.pdf',
      publishedAt: isoDaysAgo(61),
      revokedAt: null,
    }),
    createAttestationReport(),
  ]
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
  // safe_tx_hash is populated as soon as the backend proposes the Safe TX
  // (sot/phase-1.md § Mint flow steps 6–8). REJECTED rows may have been
  // rejected before propose, so leave them null.
  const safeTxHash = status === 'REJECTED' ? null : bytes32(seed + 15000)
  const onChainTxHash = isExecutedOrLater ? bytes32(seed + 17000) : null

  // USDX-35 AC6: alternate USD/IDR across the seeded list so the badge column
  // shows both states without needing live submissions.
  const inputCurrency: AmountCurrency = seed % 2 === 0 ? 'USD' : 'IDR'

  const list: RequestListItem = {
    id,
    type: opts.type,
    userId: opts.user.id,
    userName,
    userAddress,
    amount,
    amountIdr: amountIdrValue,
    inputCurrency,
    chain,
    safeType,
    status,
    safeTxHash,
    onChainTxHash,
    createdBy: opts.createdBy.id,
    createdByName: opts.createdBy.name,
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
    createdByName: opts.createdBy.name,
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
  body: {
    userAddress: string
    amount: string
    amountCurrency: AmountCurrency
    chain: string
    notes?: string
  },
  amountIdrValue: number,
  amountUsdx: string,
  safeType: SafeType
): { list: RequestListItem; detail: MintRequestDetail } {
  const seed = ++requestIdCounter + 100_000
  const id = uuidLike(seed + 9000)
  const idempotencyKey = bytes32(seed + 11000)
  // Per sot/phase-1.md § Mint flow steps 6–8, the backend proposes the Safe
  // TX (and auto-signs) as part of submission, so a freshly minted
  // PENDING_APPROVAL row already carries a safeTxHash. The Notifications
  // page (USDX-19) consumes this to deep-link to the Safe UI.
  const safeTxHash = bytes32(seed + 15000)
  const createdAt = new Date().toISOString()
  const list: RequestListItem = {
    id,
    type: 'mint',
    userId: user.id,
    userName: user.name,
    userAddress: body.userAddress,
    amount: amountUsdx,
    amountIdr: amountIdrValue.toString(),
    inputCurrency: body.amountCurrency,
    chain: body.chain as RequestChain,
    safeType,
    status: 'PENDING_APPROVAL',
    safeTxHash,
    onChainTxHash: null,
    createdBy: createdBy.id,
    createdByName: createdBy.name,
    createdAt,
  }
  const detail: MintRequestDetail = {
    id,
    type: 'mint',
    idempotencyKey,
    userId: user.id,
    userName: user.name,
    userAddress: body.userAddress,
    amount: amountUsdx,
    amountWei: amountWei(amountUsdx),
    amountIdr: amountIdrValue.toString(),
    rateUsed: RATE_USED,
    chain: body.chain as RequestChain,
    notes: body.notes && body.notes.length > 0 ? body.notes : null,
    safeType,
    status: 'PENDING_APPROVAL',
    safeTxHash,
    onChainTxHash: null,
    createdBy: createdBy.id,
    createdByName: createdBy.name,
    createdAt,
    updatedAt: createdAt,
  }
  // sot/api/mint.yaml § MintRequest now includes inputCurrency. We carry it
  // on the detail object — the type doesn't surface it yet, so cast through.
  ;(detail as MintRequestDetail & { inputCurrency: AmountCurrency }).inputCurrency =
    body.amountCurrency
  return { list, detail }
}

// USDX-46: deterministic seed → kycStatus + suspended distribution.
// Most users VERIFIED (so the picker has rich data), with a non-trivial
// minority of UNVERIFIED/PENDING/REJECTED + a few suspended for FE filter
// edge-case coverage (sot/api/users.yaml § KycStatus enum).
function deriveKycStatus(seed: number): KycStatus {
  const mod = seed % 10
  if (mod === 0) return 'UNVERIFIED'
  if (mod === 1) return 'PENDING'
  if (mod === 2) return 'REJECTED'
  return 'VERIFIED'
}
function deriveSuspended(seed: number): boolean {
  // Roughly 1/8 of users suspended.
  return seed % 8 === 0
}
function deriveEntityType(seed: number): EntityType {
  return seed % 4 === 0 ? 'LEGAL_ENTITY' : 'INDIVIDUAL'
}

export function customerToPhaseOneUser(customer: Customer, seed: number): PhaseOneUser {
  const fullName = `${customer.firstName} ${customer.lastName}`.trim()
  // Reflect the actual customer.wallets so that POST/DELETE /api/v1/users/:id/wallets
  // mutations show up in subsequent /api/v1/users[:id] reads. Falls back to a
  // single synthesized wallet when the customer has none. The synthesized
  // wallet uses `polygon` so that USDX-46 wallet picker has at least one
  // wallet on the polygon-only chain in v1.
  const wallets: PhaseOneUserWallet[] = customer.wallets.length > 0
    ? customer.wallets.map((w) => ({
        id: w.id,
        chain: w.chain,
        address: w.address,
        createdAt: w.createdAt,
      }))
    : [
        {
          id: uuidLike(seed + 23000),
          chain: 'polygon',
          address: bytes20(seed + 25000),
          createdAt: customer.createdAt,
        },
      ]
  // USDX-156 activation seed: ~1/3 pending (emailVerifiedAt null), of which
  // every 6th has a failed activation email; the rest are activated.
  const pendingActivation = seed % 3 === 0
  return {
    id: customer.id,
    name: fullName,
    email: customer.email,
    phone: seed % 2 === 0 ? `+628${seededBankAccount(seed + 27000).slice(0, 9)}` : null,
    entityType: deriveEntityType(seed),
    kycStatus: deriveKycStatus(seed),
    suspended: deriveSuspended(seed),
    emailVerifiedAt: pendingActivation ? null : customer.createdAt,
    activationEmailFailedAt:
      pendingActivation && seed % 6 === 0 ? customer.createdAt : null,
    notes: customer.organization ?? null,
    wallets,
    createdAt: customer.createdAt,
    updatedAt: customer.createdAt,
  }
}

// sot/api/chains.yaml § ChainConfig — mock for GET /api/v1/chains. Dev + prod
// run on Polygon mainnet, so the mock mirrors that (chainId 137 / polygonscan).
// Addresses are deterministic placeholders — checksum is not validated FE-side.
export function createMockChainConfigs(): ChainConfig[] {
  return [
    {
      chain: 'polygon',
      chainId: 137,
      name: 'Polygon',
      blockExplorerUrl: 'https://polygonscan.com',
      staffSafeAddress: bytes20(910001),
      managerSafeAddress: bytes20(910002),
      usdxAddress: bytes20(910003),
    },
  ]
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
// Phase 2 W2 — Consumer mint orders (backoffice "User Transaction", USDX-206).
// sot/api/orders.yaml + sot/phase-2/week2.md § Backoffice — User Transaction +
// § Fee & Spread. Read-only mock; Week 2 is mint-only (type=MINT), redeem W3.
// Distinct from the Phase-1 `requests` store above (different table/lifecycle).
// ─────────────────────────────────────────────────────────────────────────────

const ORDER_BASE_RATE = '16200.00'
const ORDER_SPREAD_BUY_PCT = '0.50'
const ORDER_SPREAD_SELL_PCT = '0.40'
const ORDER_MINT_FEE_PCT = '0.30'
const ORDER_USDX_AMOUNTS = [50, 120.5, 250, 500.75, 1_000, 2_500, 5_000, 10_000]
const ORDER_VA_BANKS: VaBank[] = ['BCA', 'BNI', 'MANDIRI', 'BRI', 'CIMB']

// Redeem (W3, USDX-245) — fee snapshot + bank codes for the redeem detail.
const ORDER_REDEEM_FEE_PCT = '1.00'
const ORDER_DISBURSEMENT_FEE_FLAT = '5000.00'
const ORDER_BANK_CODES = ['BCA', 'MANDIRI', 'BNI', 'BRI', 'CIMB']
// Static bank_code → display name reference (mirrors BE resolve; USDX-270).
const ORDER_BANK_NAMES: Record<string, string> = {
  BCA: 'BCA',
  MANDIRI: 'Mandiri',
  BNI: 'BNI',
  BRI: 'BRI',
  CIMB: 'CIMB Niaga',
}

// Coherent (payment_status, safe_status, status) tuples spanning the lifecycle
// so the list has data for every filter value (sot/api/common.yaml § statuses;
// week2.md § Lifecycle: NONE→PENDING_APPROVAL→APPROVED→EXECUTED).
interface OrderLifecycleState {
  paymentStatus: MintPaymentStatus
  safeStatus: MintSafeStatus
  status: MintOrderStatus
}
const ORDER_STATES: OrderLifecycleState[] = [
  { paymentStatus: 'REQUESTED', safeStatus: 'NONE', status: 'WAITING_FOR_PAYMENT' },
  { paymentStatus: 'WAITING_FOR_PAYMENT', safeStatus: 'NONE', status: 'WAITING_FOR_PAYMENT' },
  { paymentStatus: 'PAID', safeStatus: 'PENDING_APPROVAL', status: 'WAITING_FOR_APPROVAL' },
  { paymentStatus: 'PAID', safeStatus: 'APPROVED', status: 'WAITING_FOR_APPROVAL' },
  { paymentStatus: 'PAID', safeStatus: 'EXECUTED', status: 'COMPLETED' },
  { paymentStatus: 'PAID', safeStatus: 'EXECUTED', status: 'COMPLETED' },
  { paymentStatus: 'EXPIRED', safeStatus: 'NONE', status: 'FAILED' },
  { paymentStatus: 'PAID', safeStatus: 'REJECTED', status: 'FAILED' },
]

// IDR decimal string with 2 places (matches the "Rp …,00" display convention).
function idrDecimal(n: number): string {
  return n.toFixed(2)
}

function createOrderPair(
  user: Customer,
  seed: number,
): { list: OrderListItem; detail: OrderDetail } {
  const id = uuidLike(seed + 30_000)
  const idempotencyKey = `mint_${seededHex(20, seed + 31_000)}`
  const userAddress = bytes20(seed + 32_000)
  const amountNum = ORDER_USDX_AMOUNTS[seed % ORDER_USDX_AMOUNTS.length]!
  const amount = amountNum.toFixed(2)
  const state = ORDER_STATES[seed % ORDER_STATES.length]!
  const createdAt = pastDateRecent(seed % 45)
  // MINT_ORDER_TTL abandon window (week2.md step 7 — NOW() + TTL). 1h here.
  const expiresAt = new Date(new Date(createdAt).getTime() + 60 * 60 * 1000).toISOString()
  const safeType: SafeType = SAFE_TYPES[seed % SAFE_TYPES.length]!

  // Exchange rate + spread (week2.md § Fee & Spread).
  const baseRateNum = Number(ORDER_BASE_RATE)
  const spreadBuyNum = Number(ORDER_SPREAD_BUY_PCT)
  const effectiveRateNum = baseRateNum * (1 + spreadBuyNum / 100)
  const subtotalNum = amountNum * effectiveRateNum

  // Mint fee = % of nominal (subtotal), admin-set (fee_configs).
  const mintFeeNum = (subtotalNum * Number(ORDER_MINT_FEE_PCT)) / 100
  // Estimated revenue = spread_revenue + mint_fee (PG fee pass-through, not
  // subtracted — week2.md § Estimated revenue 2026-06-16).
  const spreadRevenueNum = (amountNum * baseRateNum * spreadBuyNum) / 100
  const estimatedRevenueIdr = idrDecimal(spreadRevenueNum + mintFeeNum)

  // Payment channel is chosen once the order leaves REQUESTED (the abandon
  // window before a method is selected). Before that, PG fee / totals are null.
  const hasChannel = state.paymentStatus !== 'REQUESTED'
  const isQris = seed % 2 === 0
  const paymentChannel: PaymentChannel | null = hasChannel ? (isQris ? 'QRIS' : 'VA') : null
  const paymentBank: VaBank | null =
    hasChannel && !isQris ? ORDER_VA_BANKS[seed % ORDER_VA_BANKS.length]! : null
  // PG fee reference tariff (week2.md § Fee — VA flat, QRIS % of subtotal).
  const pgFeeNum = !hasChannel ? null : isQris ? Math.round(subtotalNum * 0.007 * 100) / 100 : 4_440
  const pgFeeIdr = pgFeeNum === null ? null : idrDecimal(pgFeeNum)
  const totalFeeIdr = pgFeeNum === null ? null : idrDecimal(mintFeeNum + pgFeeNum)
  const totalPayIdr = pgFeeNum === null ? null : idrDecimal(subtotalNum + mintFeeNum + pgFeeNum)

  const paidAt = state.paymentStatus === 'PAID' ? createdAt : null
  // Safe TX proposed once safe_status leaves NONE; on-chain hash only at EXECUTED.
  const safeTxHash = state.safeStatus === 'NONE' ? null : bytes32(seed + 33_000)
  const onChainTxHash = state.safeStatus === 'EXECUTED' ? bytes32(seed + 34_000) : null

  const list: OrderListItem = {
    id,
    type: 'MINT',
    userId: user.id,
    userEmail: user.email,
    amount,
    totalPayIdr,
    netPayoutIdr: null,
    chain: 'polygon',
    paymentStatus: state.paymentStatus,
    safeStatus: state.safeStatus,
    status: state.status,
    createdAt,
  }

  const detail: OrderDetail = {
    id,
    type: 'MINT',
    userId: user.id,
    userEmail: user.email,
    userAddress,
    chain: 'polygon',
    idempotencyKey,
    amount,
    baseRate: ORDER_BASE_RATE,
    spreadBuyPct: ORDER_SPREAD_BUY_PCT,
    spreadSellPct: ORDER_SPREAD_SELL_PCT,
    effectiveRate: idrDecimal(effectiveRateNum),
    subtotalIdr: idrDecimal(subtotalNum),
    paymentChannel,
    paymentBank,
    mintFeePct: ORDER_MINT_FEE_PCT,
    mintFeeIdr: idrDecimal(mintFeeNum),
    pgFeeIdr,
    totalPayIdr,
    safeType,
    paymentStatus: state.paymentStatus,
    safeStatus: state.safeStatus,
    paidAt,
    safeTxHash,
    onChainTxHash,
    paymentProvider: 'MOCK',
    // REDEEM block — null for mint.
    redeemId: null,
    grossIdr: null,
    redeemFeePct: null,
    redeemFeeIdr: null,
    disbursementFeeIdr: null,
    netPayoutIdr: null,
    bankCode: null,
    bankName: null,
    bankAccountNumber: null,
    bankAccountName: null,
    lateBurn: null,
    payoutRef: null,
    burnTxHash: null,
    burnedAt: null,
    payoutCompletedAt: null,
    payoutProvider: null,
    // Shared.
    totalFeeIdr,
    estimatedRevenueIdr,
    status: state.status,
    expiresAt,
    createdAt,
    updatedAt: createdAt,
  }

  return { list, detail }
}

// ─── Phase 2 W3 — Consumer redeem orders (USDX-245) ───
// sot/api/orders.yaml + sot/phase-2/week3.md § Backoffice — User Transaction
// (Redeem) + § Fee & Spread. Redeem tidak lewat Safe: burn = self-sign user,
// payout = disbursement. Fee dipotong dari gross (kebalikan mint).
interface RedeemLifecycleState {
  status: RedeemStatus
  burned: boolean
  payoutStarted: boolean
  payoutComplete: boolean
  lateBurn: boolean
}

// Coherent tuples spanning the redeem lifecycle so the list has a row for every
// status (incl. a late-burn case). sot/api/common.yaml § RedeemStatus.
const REDEEM_STATES: RedeemLifecycleState[] = [
  { status: 'AWAITING_BURN', burned: false, payoutStarted: false, payoutComplete: false, lateBurn: false },
  { status: 'BURNED', burned: true, payoutStarted: false, payoutComplete: false, lateBurn: false },
  { status: 'PROCESSING_PAYOUT', burned: true, payoutStarted: true, payoutComplete: false, lateBurn: false },
  { status: 'PAYOUT_COMPLETE', burned: true, payoutStarted: true, payoutComplete: true, lateBurn: false },
  { status: 'PAYOUT_COMPLETE', burned: true, payoutStarted: true, payoutComplete: true, lateBurn: false },
  { status: 'EXPIRED', burned: false, payoutStarted: false, payoutComplete: false, lateBurn: false },
  { status: 'BURNED', burned: true, payoutStarted: false, payoutComplete: false, lateBurn: true },
]

function createRedeemOrderPair(
  user: Customer,
  seed: number,
): { list: OrderListItem; detail: OrderDetail } {
  const id = uuidLike(seed + 40_000)
  const redeemId = bytes32(seed + 41_000)
  const amountNum = ORDER_USDX_AMOUNTS[seed % ORDER_USDX_AMOUNTS.length]!
  const amount = amountNum.toFixed(2)
  const state = REDEEM_STATES[seed % REDEEM_STATES.length]!
  const createdAt = pastDateRecent(seed % 45)
  // REDEEM_BURN_TTL window (week3.md § Status Flow). 1h here.
  const expiresAt = new Date(new Date(createdAt).getTime() + 60 * 60 * 1000).toISOString()

  // Exchange rate + spread JUAL; fee dipotong dari gross (week3.md § Fee & Spread).
  const baseRateNum = Number(ORDER_BASE_RATE)
  const spreadSellNum = Number(ORDER_SPREAD_SELL_PCT)
  const effectiveRateNum = baseRateNum * (1 - spreadSellNum / 100)
  const grossNum = amountNum * effectiveRateNum
  const redeemFeeNum = (grossNum * Number(ORDER_REDEEM_FEE_PCT)) / 100
  const disbursementFeeNum = Number(ORDER_DISBURSEMENT_FEE_FLAT)
  const totalFeeNum = redeemFeeNum + disbursementFeeNum
  // net_payout = gross − total_fee; desimal dibulatkan KE BAWAH, wajib ≥ Rp 10.000.
  const netPayoutNum = Math.floor(grossNum - totalFeeNum)
  // estimated_revenue = spread_sell_revenue + redeem_fee (disbursement pass-through).
  const spreadRevenueNum = (amountNum * baseRateNum * spreadSellNum) / 100
  const estimatedRevenueIdr = idrDecimal(spreadRevenueNum + redeemFeeNum)
  const netPayoutIdr = idrDecimal(netPayoutNum)

  // Bank tujuan — full account number + resolved bank name (un-mask 2026-06-25, USDX-270).
  const bankCode = ORDER_BANK_CODES[seed % ORDER_BANK_CODES.length]!
  const bankName = ORDER_BANK_NAMES[bankCode] ?? bankCode
  const last4 = String((seed * 7919) % 10000).padStart(4, '0')
  const bankAccountNumber = `${String(1_000_000 + ((seed * 31) % 9_000_000))}${last4}`
  const bankAccountName = `${user.firstName} ${user.lastName}`.toUpperCase()

  // On-chain burn fields appear once the Redeem event is detected.
  const userAddress = state.burned ? bytes20(seed + 42_000) : null
  const burnTxHash = state.burned ? bytes32(seed + 43_000) : null
  const burnedAt = state.burned
    ? new Date(new Date(createdAt).getTime() + 12 * 60 * 1000).toISOString()
    : null
  const payoutRef = state.payoutStarted ? `disb_${seededHex(20, seed + 44_000)}` : null
  const payoutCompletedAt = state.payoutComplete
    ? new Date(new Date(createdAt).getTime() + 20 * 60 * 1000).toISOString()
    : null

  const list: OrderListItem = {
    id,
    type: 'REDEEM',
    userId: user.id,
    userEmail: user.email,
    amount,
    totalPayIdr: null,
    netPayoutIdr,
    chain: 'polygon',
    paymentStatus: null,
    safeStatus: null,
    status: state.status,
    createdAt,
  }

  const detail: OrderDetail = {
    id,
    type: 'REDEEM',
    userId: user.id,
    userEmail: user.email,
    userAddress,
    chain: 'polygon',
    amount,
    baseRate: ORDER_BASE_RATE,
    spreadBuyPct: null,
    spreadSellPct: ORDER_SPREAD_SELL_PCT,
    effectiveRate: idrDecimal(effectiveRateNum),
    // MINT block — null for redeem.
    idempotencyKey: null,
    subtotalIdr: null,
    paymentChannel: null,
    paymentBank: null,
    mintFeePct: null,
    mintFeeIdr: null,
    pgFeeIdr: null,
    totalPayIdr: null,
    safeType: null,
    paymentStatus: null,
    safeStatus: null,
    paidAt: null,
    safeTxHash: null,
    onChainTxHash: null,
    paymentProvider: null,
    // REDEEM block.
    redeemId,
    grossIdr: idrDecimal(grossNum),
    redeemFeePct: ORDER_REDEEM_FEE_PCT,
    redeemFeeIdr: idrDecimal(redeemFeeNum),
    disbursementFeeIdr: idrDecimal(disbursementFeeNum),
    netPayoutIdr,
    bankCode,
    bankName,
    bankAccountNumber,
    bankAccountName,
    lateBurn: state.lateBurn,
    payoutRef,
    burnTxHash,
    burnedAt,
    payoutCompletedAt,
    payoutProvider: 'MOCK',
    // Shared.
    totalFeeIdr: idrDecimal(totalFeeNum),
    estimatedRevenueIdr,
    status: state.status,
    expiresAt,
    createdAt,
    updatedAt: burnedAt ?? createdAt,
  }

  return { list, detail }
}

export function createMockOrders(
  customers: Customer[],
  count = 48,
  redeemCount = 24,
): { list: OrderListItem[]; details: Map<string, OrderDetail> } {
  const list: OrderListItem[] = []
  const details = new Map<string, OrderDetail>()
  if (customers.length === 0) return { list, details }
  for (let i = 0; i < count; i++) {
    const seed = i + 1
    const user = customers[i % customers.length]!
    const pair = createOrderPair(user, seed)
    list.push(pair.list)
    details.set(pair.list.id, pair.detail)
  }
  // Redeem orders (W3, USDX-245) — same store, union mint + redeem.
  for (let i = 0; i < redeemCount; i++) {
    const seed = i + 1
    const user = customers[i % customers.length]!
    const pair = createRedeemOrderPair(user, seed)
    list.push(pair.list)
    details.set(pair.list.id, pair.detail)
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return { list, details }
}

// Burn submission factory — used by POST /api/v1/burn handler.
// Persists to the same requestList + details store so /requests reflects it.
// ─────────────────────────────────────────────────────────────────────────────

interface BurnSubmissionInput {
  userName: string
  userAddress: string
  amount: string
  amountCurrency: AmountCurrency
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
  // sot/phase-1.md L154: USD = 1:1 USDX, IDR → divide by rate.
  const amountUsdx =
    input.amountCurrency === 'USD'
      ? input.amount
      : (Number.parseFloat(input.amount) / Number.parseFloat(RATE_USED)).toFixed(6)
  const amountIdrValue =
    input.amountCurrency === 'IDR'
      ? Math.round(Number.parseFloat(input.amount)).toString()
      : decimalIdr(amountUsdx)
  const amountWeiValue = amountWei(amountUsdx)
  // Per sot/phase-1.md flow: backend computes IDR, checks role vs threshold,
  // then routes to STAFF or MANAGER Safe. Mock heuristic: route to MANAGER
  // when amountIDR is at or above 1B (approximate threshold from phase-1.md).
  const safeType: SafeType =
    Number(amountIdrValue) >= 1_000_000_000 ? 'MANAGER' : 'STAFF'
  const createdAt = new Date().toISOString()
  const userId = matchedUser?.id ?? `usr_burn_${seed}`
  // Per sot/phase-1.md § Burn flow steps 5–8, the backend proposes the Safe
  // TX (and auto-signs) as part of submission, so a freshly minted
  // PENDING_APPROVAL row already carries a safeTxHash. Consumed by the
  // Notifications page (USDX-19).
  const safeTxHash = bytes32(seed + 200)

  const list: RequestListItem = {
    id,
    type: 'burn',
    userId,
    userName: input.userName.trim(),
    userAddress: input.userAddress.trim(),
    amount: amountUsdx,
    amountIdr: amountIdrValue,
    inputCurrency: input.amountCurrency,
    chain: input.chain,
    safeType,
    status: 'PENDING_APPROVAL',
    safeTxHash,
    onChainTxHash: null,
    createdBy: createdBy.id,
    createdByName: createdBy.name,
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
    amount: amountUsdx,
    amountWei: amountWeiValue,
    amountIdr: amountIdrValue,
    rateUsed: RATE_USED,
    chain: input.chain,
    notes: input.notes && input.notes.trim() ? input.notes.trim() : null,
    safeType,
    safeTxHash,
    onChainTxHash: null,
    depositTxHash: input.depositTxHash.trim(),
    bankName: input.bankName.trim(),
    bankAccount: input.bankAccount.trim(),
    createdBy: createdBy.id,
    createdByName: createdBy.name,
    createdAt,
    updatedAt: createdAt,
  }
  ;(detail as BurnRequestDetail & { inputCurrency: AmountCurrency }).inputCurrency =
    input.amountCurrency

  return { list, detail }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard stats (sot/openapi.yaml § /api/v1/dashboard/stats)
// Derives totalMinted/Burned + status breakdown from the request list so that
// stats stay consistent with whatever rows the requests endpoint is serving.
// Supply, Safe balances, and the active rate use stable mock values.
// ─────────────────────────────────────────────────────────────────────────────

function decimalToCents(value: string): number {
  // Returns signed integer cents. Inputs are always 2-decimal strings produced
  // by `decimalAmount()`, so we never have to round.
  const negative = value.startsWith('-')
  const abs = negative ? value.slice(1) : value
  const [whole = '0', fraction = ''] = abs.split('.')
  const cents = (fraction + '00').slice(0, 2).padEnd(2, '0')
  const total = Number.parseInt(whole, 10) * 100 + Number.parseInt(cents, 10)
  return negative ? -total : total
}

function centsToDecimal(totalCents: number): string {
  const negative = totalCents < 0
  const abs = Math.abs(totalCents)
  const whole = Math.trunc(abs / 100).toString()
  const cents = (abs % 100).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${cents}`
}

function sumDecimals(values: string[]): string {
  let totalCents = 0
  for (const v of values) totalCents += decimalToCents(v)
  return centsToDecimal(totalCents)
}

const SAFE_BALANCE_STAFF = '750000.00'
const SAFE_BALANCE_MANAGER = '5250000.00'

export function computeDashboardStats(
  requests: RequestListItem[]
): DashboardStats {
  const mintExecuted = requests.filter(
    (r) => r.type === 'mint' && r.status === 'EXECUTED'
  )
  const burnExecuted = requests.filter(
    (r) => r.type === 'burn' &&
      (r.status === 'EXECUTED' || r.status === 'IDR_TRANSFERRED')
  )

  const totalMinted = sumDecimals(mintExecuted.map((r) => r.amount))
  const totalBurned = sumDecimals(burnExecuted.map((r) => r.amount))
  // Supply on-chain = total ever minted − total ever burned + Safe holdings
  const totalSupply = centsToDecimal(
    decimalToCents(totalMinted) -
      decimalToCents(totalBurned) +
      decimalToCents(SAFE_BALANCE_STAFF) +
      decimalToCents(SAFE_BALANCE_MANAGER)
  )

  const requestsByStatus = {
    PENDING_APPROVAL: 0,
    APPROVED: 0,
    EXECUTED: 0,
    REJECTED: 0,
  }
  for (const r of requests) {
    if (r.status === 'PENDING_APPROVAL') requestsByStatus.PENDING_APPROVAL++
    else if (r.status === 'APPROVED') requestsByStatus.APPROVED++
    else if (r.status === 'EXECUTED' || r.status === 'IDR_TRANSFERRED') {
      requestsByStatus.EXECUTED++
    } else if (r.status === 'REJECTED') requestsByStatus.REJECTED++
  }

  return {
    totalSupply,
    totalMinted,
    totalBurned,
    pendingRequests: requestsByStatus.PENDING_APPROVAL,
    requestsByStatus,
    safeBalances: {
      staff: SAFE_BALANCE_STAFF,
      manager: SAFE_BALANCE_MANAGER,
    },
    currentRate: RATE_USED,
  }
}


// ─── Phase 2 Week 1 — KYC review list (sot/api/kyc.yaml § KycListItem) ───
// USDX-154: seeded rows for the /kyc backoffice list. One row per user
// (kyc.user_id is unique); statuses cycle PENDING/VERIFIED/REJECTED so every
// filter has matches. The list handler sorts submitted_at ascending — the
// factory intentionally returns unsorted rows so tests exercise that sort.

const KYC_REVIEWER_NAMES = ['Andi Wijaya', 'Siti Rahma', 'Budi Santoso']

export function createKycListItem(overrides: Partial<KycListItem> = {}): KycListItem {
  return {
    id: uuidLike(70000),
    userId: uuidLike(71000),
    userEmail: 'user@example.com',
    entityType: 'INDIVIDUAL',
    status: 'PENDING',
    submissionCount: 1,
    submittedAt: pastDateRecent(3),
    reviewedAt: null,
    reviewedByName: null,
    ...overrides,
  }
}

export function createMockKycList(count = 24): KycListItem[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = i + 1
    const status: KycStatus = (['PENDING', 'VERIFIED', 'REJECTED'] as const)[seed % 3]!
    const name = CUSTOMER_NAMES[seed % CUSTOMER_NAMES.length]!
    const [first, last] = splitName(name)
    const reviewed = status !== 'PENDING'
    return createKycListItem({
      id: uuidLike(seed + 70000),
      userId: uuidLike(seed + 71000),
      userEmail: customerEmail(first, last, seed),
      status,
      // Rejected users resubmit (unlimited resubmit, week1.md § Status Flow),
      // so they tend to carry higher submission counts.
      submissionCount: status === 'REJECTED' ? 1 + (seed % 3) : 1 + (seed % 2),
      submittedAt: pastDateRecent(seed % 40),
      reviewedAt: reviewed ? pastDateRecent(seed % 20) : null,
      reviewedByName: reviewed ? KYC_REVIEWER_NAMES[seed % KYC_REVIEWER_NAMES.length]! : null,
    })
  })
}

// ─── USDX-155 — KYC detail + audit trail (sot/api/kyc.yaml § KycDetail/KycReviewLog) ───
// Detail rows mirror the seeded list (same seed → same name/email as
// createMockKycList). PII here is fake-but-plausible plaintext — the mock
// stands in for what the real BE returns AFTER decryption. Photo URLs imitate
// Railway Bucket presigned GETs (host per live BE: t3.storageapi.dev);
// `urlExpiresAt` is stamped by the handler at serve time (TTL 5 min), not here.

const BIRTH_PLACES = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Semarang', 'Yogyakarta']
const STREETS = ['Jl. Sudirman', 'Jl. Gatot Subroto', 'Jl. Thamrin', 'Jl. Diponegoro', 'Jl. Asia Afrika']

let kycReviewIdCounter = 1

export function createKycReviewLog(overrides: Partial<KycReviewLog> = {}): KycReviewLog {
  const n = kycReviewIdCounter++
  return {
    id: uuidLike(n + 80000),
    action: 'SUBMITTED',
    actorStaffId: null,
    actorStaffName: null,
    actorUserId: null,
    reason: null,
    ipAddress: `10.0.${n % 255}.${(n * 7) % 255}`,
    createdAt: pastDateRecent(n % 30),
    ...overrides,
  }
}

function mockPresignedUrl(userId: string, docKind: 'ktp' | 'selfie', seed: number): string {
  return `https://t3.storageapi.dev/usdx-kyc/kyc/${userId}/${docKind}/${uuidLike(seed)}.jpg?X-Amz-Expires=300&X-Amz-Signature=${seededHex(32, seed)}`
}

export function createKycDetail(
  item: KycListItem,
  seed: number,
  overrides: Partial<KycDetail> = {}
): KycDetail {
  const name = CUSTOMER_NAMES[seed % CUSTOMER_NAMES.length]!
  const [firstName, lastName] = splitName(name)
  return {
    id: item.id,
    userId: item.userId,
    userEmail: item.userEmail,
    entityType: item.entityType,
    status: item.status,
    submissionCount: item.submissionCount,
    firstName,
    lastName: lastName || 'Wijaya',
    dob: `19${70 + (seed % 30)}-${String(1 + (seed % 12)).padStart(2, '0')}-${String(1 + (seed % 28)).padStart(2, '0')}`,
    birthPlace: BIRTH_PLACES[seed % BIRTH_PLACES.length]!,
    identityType: 'KTP',
    // 16-digit KTP number: '3171' province/city prefix + 12 seeded digits.
    identityNumber: `3171${seededBankAccount(seed)}`,
    country: 'ID',
    addressLine1: `${STREETS[seed % STREETS.length]!} No. ${1 + (seed % 120)}`,
    addressLine2: seed % 3 === 0 ? `RT ${1 + (seed % 9)}/RW ${1 + (seed % 5)}` : null,
    ktpPhotoUrl: mockPresignedUrl(item.userId, 'ktp', seed + 75000),
    selfiePhotoUrl: mockPresignedUrl(item.userId, 'selfie', seed + 76000),
    urlExpiresAt: null,
    rejectionReason:
      item.status === 'REJECTED'
        ? 'Foto KTP buram, mohon submit ulang dengan kualitas lebih jelas'
        : null,
    submittedAt: item.submittedAt,
    reviewedBy: item.reviewedByName ? uuidLike(seed + 77000) : null,
    reviewedByName: item.reviewedByName,
    reviewedAt: item.reviewedAt,
    createdAt: item.submittedAt ?? pastDateRecent(seed % 40),
    updatedAt: item.reviewedAt ?? item.submittedAt ?? pastDateRecent(seed % 40),
    ...overrides,
  }
}

/** Seeded audit trail per detail row, newest-first (contract order). */
export function createMockKycReviews(detail: KycDetail): KycReviewLog[] {
  const rows: KycReviewLog[] = [
    createKycReviewLog({
      action: 'SUBMITTED',
      actorUserId: detail.userId,
      createdAt: detail.createdAt,
    }),
  ]
  for (let i = 1; i < detail.submissionCount; i++) {
    rows.push(
      createKycReviewLog({
        action: 'RESUBMITTED',
        actorUserId: detail.userId,
        createdAt: detail.submittedAt ?? detail.createdAt,
      })
    )
  }
  if (detail.status === 'VERIFIED' || detail.status === 'REJECTED') {
    rows.push(
      createKycReviewLog({
        action: detail.status === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
        actorStaffId: detail.reviewedBy,
        actorStaffName: detail.reviewedByName,
        reason: detail.status === 'REJECTED' ? detail.rejectionReason : null,
        createdAt: detail.reviewedAt ?? detail.updatedAt,
      })
    )
  }
  // Newest first (kyc.yaml § reviewsHistory: reverse-chronological).
  return rows.reverse()
}

export function createMockKycDetailState(list: KycListItem[]): {
  details: Map<string, KycDetail>
  reviews: Map<string, KycReviewLog[]>
} {
  const details = new Map<string, KycDetail>()
  const reviews = new Map<string, KycReviewLog[]>()
  list.forEach((item, i) => {
    const detail = createKycDetail(item, i + 1)
    details.set(item.id, detail)
    reviews.set(item.id, createMockKycReviews(detail))
  })
  return { details, reviews }
}

// ─────────────────────────────────────────────────────────────────────────────
// USDX-485 — kontak on-call insiden uang (audit alur uang P1-18)
// ─────────────────────────────────────────────────────────────────────────────

let oncallIdCounter = 1

/**
 * Seed daftar on-call. Sengaja TIDAK menutup semua kategori: MINT, REDEEM,
 * FRAUD, INFRA, dan OTHER dibiarkan kosong supaya keadaan "kategori tanpa
 * penanggung jawab" — keadaan yang justru dibereskan tiket ini — terlihat di
 * dev/test alih-alih tersembunyi di balik data mock yang terlalu rapi.
 */
export function createInitialOncallContacts(): OncallContact[] {
  oncallIdCounter = 1
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  return [
    {
      id: `oncall-${oncallIdCounter++}`,
      name: 'Budi Santoso',
      role: 'Ops Lead',
      channel: 'PHONE',
      contactValue: '+6281234567890',
      categories: ['PAYOUT', 'RECONCILIATION'],
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `oncall-${oncallIdCounter++}`,
      name: 'Ops Uang',
      role: 'Kanal tim',
      channel: 'SLACK',
      contactValue: '#ops-uang',
      categories: ['SECURITY'],
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function createOncallContact(
  input: CreateOncallContact & { createdBy: string | null }
): OncallContact {
  const now = new Date().toISOString()
  return {
    id: `oncall-${oncallIdCounter++}`,
    name: input.name,
    role: input.role,
    channel: input.channel,
    contactValue: input.contactValue,
    categories: [...input.categories],
    createdBy: input.createdBy,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  }
}
