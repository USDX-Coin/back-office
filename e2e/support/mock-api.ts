import type { Page, Route } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Hermetic mock of the Phase-1 API for E2E.
//
// Playwright intercepts `**/api/v1/**` at the network layer. The dev server runs
// the MSW browser worker, but the paths exercised here (auth, requests, mint,
// burn, users, dashboard, rate, chains, threshold, staff, kyc) are all in MSW's
// `INTEGRATION_PATHS` bypass list — MSW lets them hit the network, so these
// routes win. The result is a self-contained suite that runs in CI with no
// backend / credentials and produces zero on-chain side effects (mint/burn
// "submission" is mocked — see USDX-26 PR notes for the rationale).
//
// State is per-`installMockApi` call (i.e. per test). Pass `users` / `requests`
// to pre-seed, or `routes` to force error/edge responses for a single endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_TOKEN = 'mock-e2e-token'

export const ADMIN_STAFF = {
  id: '00000000-0000-7000-8000-0000000000a1',
  name: 'System Admin',
  email: 'admin@usdx.io',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

export const POLYGON_CHAIN = {
  chain: 'polygon',
  chainId: 137,
  name: 'Polygon',
  blockExplorerUrl: 'https://polygonscan.com',
  staffSafeAddress: '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015',
  managerSafeAddress: '0xbB3e70397F3668D6Fd9C25e36a6FB151241EE015',
  usdxAddress: '0x2702d7043693651BB8A3D2Ec1C296B20692C7426',
}

export const VERIFIED_USER = {
  id: '00000000-0000-7000-8000-0000000000d1',
  name: 'Robert Deon',
  email: 'robert.deon@example.com',
  phone: '+628123456789' as string | null,
  entityType: 'INDIVIDUAL' as const,
  kycStatus: 'VERIFIED' as const,
  suspended: false,
  // USDX-156 activation fields (users.yaml § User)
  emailVerifiedAt: '2026-01-02T00:00:00.000Z' as string | null,
  activationEmailFailedAt: null as string | null,
  notes: null as string | null,
  wallets: [
    {
      id: 'wal_polygon_d1',
      chain: 'polygon',
      address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// USDX-156 — seeded activation states for the /users filter + resend specs.
export const PENDING_ACTIVATION_USER = {
  ...VERIFIED_USER,
  id: '00000000-0000-7000-8000-0000000000d2',
  name: 'Pending Pat',
  email: 'pending.pat@example.com',
  phone: null as string | null,
  kycStatus: 'UNVERIFIED' as const,
  emailVerifiedAt: null as string | null,
  wallets: [],
}

export const FAILED_ACTIVATION_USER = {
  ...VERIFIED_USER,
  id: '00000000-0000-7000-8000-0000000000d3',
  name: 'Failed Fia',
  email: 'failed.fia@example.com',
  phone: null as string | null,
  kycStatus: 'UNVERIFIED' as const,
  emailVerifiedAt: null as string | null,
  activationEmailFailedAt: '2026-06-09T00:00:00.000Z' as string | null,
  wallets: [],
}

// USDX-207: spread directional (sot/api/rate.yaml). Spread 0 → effective == base.
const RATE_INFO = {
  baseRate: '16250.0000',
  mode: 'MANUAL' as const,
  spreadBuyPct: '0',
  spreadSellPct: '0',
  effectiveBuyRate: '16250.0000',
  effectiveSellRate: '16250.0000',
  updatedAt: '2026-05-01T00:00:00.000Z',
}
// Mint OTC = beli → use the effective buy rate for the conversion + rateUsed.
const RATE_USED = RATE_INFO.effectiveBuyRate

// USDX-207 + USDX-245: fee config (sot/api/fee.yaml). Full 5-field snapshot —
// W2 mint/PG tariffs + W3 redeem fee % + disbursement fee flat.
const FEE_CONFIG = {
  id: 'fee-0001',
  mintFeePct: '1.0',
  pgFeeVaFlat: '4000.00',
  pgFeeQrisPct: '0.7',
  redeemFeePct: '1.0',
  disbursementFeeFlat: '5000.00',
  updatedBy: ADMIN_STAFF.id,
  createdAt: '2026-05-01T00:00:00.000Z',
}
const THRESHOLD = { id: 'thr_1', mode: 'IDR' as const, amount: '1000000000', updatedBy: ADMIN_STAFF.id, createdAt: '2026-05-01T00:00:00.000Z' }
const DASHBOARD_STATS = {
  totalSupply: '1000000.00',
  totalMinted: '1200000.00',
  totalBurned: '200000.00',
  pendingRequests: 2,
  requestsByStatus: { PENDING_APPROVAL: 2, APPROVED: 1, EXECUTED: 4, REJECTED: 1 },
  safeBalances: { staff: '750000.00', manager: '5250000.00' },
  currentRate: '16250.00',
}

const HEX64 = (c: string) => '0x' + c.repeat(64)

interface MockRequest {
  id: string
  type: 'mint' | 'burn'
  userId: string
  userName: string
  userAddress: string
  amount: string
  amountWei: string
  amountIdr: string
  inputCurrency: 'USD' | 'IDR'
  rateUsed: string
  chain: string
  notes: string | null
  safeType: 'STAFF' | 'MANAGER'
  status: string
  safeTxHash: string | null
  onChainTxHash: string | null
  depositTxHash?: string
  bankName?: string
  bankAccount?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  idempotencyKey: string
}

function listItem(r: MockRequest) {
  return {
    id: r.id, type: r.type, userId: r.userId, userName: r.userName, userAddress: r.userAddress,
    amount: r.amount, amountIdr: r.amountIdr, inputCurrency: r.inputCurrency, chain: r.chain,
    safeType: r.safeType, status: r.status, safeTxHash: r.safeTxHash, onChainTxHash: r.onChainTxHash,
    createdBy: r.createdBy, createdAt: r.createdAt,
  }
}

function detailItem(r: MockRequest) {
  const base = {
    id: r.id, type: r.type, idempotencyKey: r.idempotencyKey, userId: r.userId, userName: r.userName,
    userAddress: r.userAddress, amount: r.amount, amountWei: r.amountWei, amountIdr: r.amountIdr,
    inputCurrency: r.inputCurrency, rateUsed: r.rateUsed, chain: r.chain, notes: r.notes,
    safeType: r.safeType, status: r.status, safeTxHash: r.safeTxHash, onChainTxHash: r.onChainTxHash,
    createdBy: r.createdBy, createdAt: r.createdAt, updatedAt: r.updatedAt,
  }
  return r.type === 'burn'
    ? { ...base, depositTxHash: r.depositTxHash, bankName: r.bankName, bankAccount: r.bankAccount }
    : base
}

function seedRequests(): MockRequest[] {
  const mk = (over: Partial<MockRequest>): MockRequest => ({
    id: over.id!, type: 'mint', userId: VERIFIED_USER.id, userName: VERIFIED_USER.name,
    userAddress: VERIFIED_USER.wallets[0].address, amount: '100.000000', amountWei: '100000000',
    amountIdr: '1625000.00', inputCurrency: 'USD', rateUsed: '16250.0000', chain: 'polygon',
    notes: null, safeType: 'STAFF', status: 'EXECUTED', safeTxHash: HEX64('a'), onChainTxHash: HEX64('b'),
    createdBy: ADMIN_STAFF.id, createdAt: '2026-05-10T10:00:00.000Z', updatedAt: '2026-05-10T10:00:00.000Z',
    idempotencyKey: HEX64('0'), ...over,
  })
  return [
    mk({ id: 'req_mint_executed', amount: '1000.000000', amountIdr: '16250000.00' }),
    mk({ id: 'req_mint_pending', status: 'PENDING_APPROVAL', onChainTxHash: null, createdAt: '2026-05-11T09:00:00.000Z' }),
    mk({ id: 'req_mint_rejected', status: 'REJECTED', safeTxHash: null, onChainTxHash: null, createdAt: '2026-05-09T08:00:00.000Z' }),
    mk({ id: 'req_burn_executed', type: 'burn', status: 'IDR_TRANSFERRED', amount: '50.000000', amountIdr: '812500.00', safeType: 'MANAGER', depositTxHash: HEX64('c'), bankName: 'BCA', bankAccount: '1234567890', createdAt: '2026-05-11T11:00:00.000Z' }),
    mk({ id: 'req_burn_pending', type: 'burn', status: 'PENDING_APPROVAL', onChainTxHash: null, amount: '10.000000', amountIdr: '162500.00', depositTxHash: HEX64('d'), bankName: 'Mandiri', bankAccount: '9876543210', createdAt: '2026-05-11T07:30:00.000Z' }),
  ]
}

// ── Consumer orders / "User Transaction" (USDX-206 — sot/api/orders.yaml) ────

// USDX-547 — partner ownership on an order (migration 0076).
export interface MockOrderPartner {
  id: string
  code: string
  displayName: string
}

export interface MockOrder {
  id: string
  type: 'MINT' | 'REDEEM'
  /** NULL for a partner-CUSTOMER order — no `users` row exists for it at all. */
  userId: string | null
  /** `(partner customer)` when there is no `users` row (USDX-571). */
  userEmail: string
  // USDX-547 — resolved `partners` row (LEFT JOIN); null for retail.
  partner: MockOrderPartner | null
  onBehalfOf: 'SELF' | 'CUSTOMER' | null
  partnerCustomerId: string | null
  externalReference: string | null
  userAddress: string
  chain: string
  idempotencyKey: string
  amount: string
  baseRate: string
  spreadBuyPct: string
  spreadSellPct: string
  effectiveRate: string
  subtotalIdr: string
  paymentChannel: 'VA' | 'QRIS' | null
  paymentBank: string | null
  mintFeePct: string
  mintFeeIdr: string
  pgFeeIdr: string | null
  totalFeeIdr: string | null
  totalPayIdr: string | null
  estimatedRevenueIdr: string
  safeType: 'STAFF' | 'MANAGER' | null
  paymentStatus: 'REQUESTED' | 'WAITING_FOR_PAYMENT' | 'PAID' | 'EXPIRED' | null
  safeStatus: 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | null
  status:
    | 'WAITING_FOR_PAYMENT'
    | 'WAITING_FOR_APPROVAL'
    | 'COMPLETED'
    | 'FAILED'
    | 'AWAITING_BURN'
    | 'BURNED'
    | 'PROCESSING_PAYOUT'
    | 'PAYOUT_COMPLETE'
    | 'EXPIRED'
  paymentProvider: string | null
  paidAt: string | null
  expiresAt: string
  safeTxHash: string | null
  onChainTxHash: string | null
  // REDEEM block (W3, USDX-245) — present only for type=REDEEM rows.
  netPayoutIdr?: string | null
  redeemId?: string | null
  grossIdr?: string | null
  redeemFeePct?: string | null
  redeemFeeIdr?: string | null
  disbursementFeeIdr?: string | null
  bankCode?: string | null
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  lateBurn?: boolean | null
  payoutRef?: string | null
  burnTxHash?: string | null
  burnedAt?: string | null
  payoutCompletedAt?: string | null
  payoutProvider?: string | null
  createdAt: string
  updatedAt: string
}

// OrderListItem projection (the list endpoint omits the fee/spread breakdown).
function orderListItem(o: MockOrder) {
  return {
    id: o.id, type: o.type, userId: o.userId, userEmail: o.userEmail,
    // USDX-547 — the list row carries the resolved partner; `onBehalfOf` rides
    // along because "the partner itself" and "the partner's customer" are
    // different rows to an operator.
    partner: o.partner, onBehalfOf: o.onBehalfOf,
    amount: o.amount, totalPayIdr: o.totalPayIdr, netPayoutIdr: o.netPayoutIdr ?? null,
    chain: o.chain, paymentStatus: o.paymentStatus, safeStatus: o.safeStatus,
    status: o.status, createdAt: o.createdAt,
  }
}

export function seedOrders(): MockOrder[] {
  const mk = (over: Partial<MockOrder>): MockOrder => ({
    id: over.id!, type: 'MINT', userId: VERIFIED_USER.id, userEmail: VERIFIED_USER.email,
    partner: null, onBehalfOf: null, partnerCustomerId: null, externalReference: null,
    userAddress: VERIFIED_USER.wallets[0].address, chain: 'polygon',
    idempotencyKey: 'mint_' + HEX64('1').slice(2, 22),
    amount: '250.00', baseRate: '16200.00', spreadBuyPct: '0.50', spreadSellPct: '0.40',
    effectiveRate: '16281.00', subtotalIdr: '4070250.00',
    paymentChannel: 'VA', paymentBank: 'BCA', mintFeePct: '0.30', mintFeeIdr: '12210.75',
    pgFeeIdr: '4440.00', totalFeeIdr: '16650.75', totalPayIdr: '4086900.75', estimatedRevenueIdr: '32310.75',
    safeType: 'STAFF', paymentStatus: 'PAID', safeStatus: 'EXECUTED', status: 'COMPLETED',
    paymentProvider: 'MOCK', paidAt: '2026-06-01T00:05:00.000Z', expiresAt: '2026-06-01T01:00:00.000Z',
    safeTxHash: HEX64('b'), onChainTxHash: HEX64('a'),
    createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:10:00.000Z', ...over,
  })
  return [
    mk({ id: 'ord_completed', amount: '1000.00', status: 'COMPLETED', paymentStatus: 'PAID', safeStatus: 'EXECUTED' }),
    mk({ id: 'ord_awaiting', amount: '500.00', status: 'WAITING_FOR_APPROVAL', paymentStatus: 'PAID', safeStatus: 'PENDING_APPROVAL', onChainTxHash: null, createdAt: '2026-06-02T09:00:00.000Z' }),
    mk({ id: 'ord_unpaid', amount: '120.50', status: 'WAITING_FOR_PAYMENT', paymentStatus: 'REQUESTED', safeStatus: 'NONE', paymentChannel: null, paymentBank: null, pgFeeIdr: null, totalFeeIdr: null, totalPayIdr: null, safeTxHash: null, onChainTxHash: null, paidAt: null, createdAt: '2026-06-03T08:00:00.000Z' }),
  ]
}

// USDX-245 — redeem orders for the User Transaction redeem E2E. MINT-only
// fields are null; the redeem block carries fee / net payout / bank / burn tx.
export function seedRedeemOrders(): MockOrder[] {
  const rmk = (over: Partial<MockOrder>): MockOrder => ({
    id: over.id!, type: 'REDEEM', userId: VERIFIED_USER.id, userEmail: VERIFIED_USER.email,
    partner: null, onBehalfOf: null, partnerCustomerId: null, externalReference: null,
    userAddress: VERIFIED_USER.wallets[0].address, chain: 'polygon',
    idempotencyKey: '', amount: '100.00', baseRate: '16000.00',
    spreadBuyPct: '0', spreadSellPct: '2.00', effectiveRate: '15680.00',
    subtotalIdr: '0', paymentChannel: null, paymentBank: null,
    mintFeePct: '0', mintFeeIdr: '0', pgFeeIdr: null,
    totalFeeIdr: '20680.00', totalPayIdr: null, estimatedRevenueIdr: '47680.00',
    safeType: null, paymentStatus: null, safeStatus: null, status: 'PAYOUT_COMPLETE',
    paymentProvider: null, paidAt: null, expiresAt: '2026-06-04T01:00:00.000Z',
    safeTxHash: null, onChainTxHash: null,
    // redeem block
    netPayoutIdr: '1547320.00', redeemId: HEX64('c'), grossIdr: '1568000.00',
    redeemFeePct: '1.00', redeemFeeIdr: '15680.00', disbursementFeeIdr: '5000.00',
    bankCode: 'BCA', bankName: 'BCA', bankAccountNumber: '1234563271', bankAccountName: 'BUDI SANTOSO',
    lateBurn: false, payoutRef: 'disb_e2e001', burnTxHash: HEX64('d'),
    burnedAt: '2026-06-04T00:12:00.000Z', payoutCompletedAt: '2026-06-04T00:20:00.000Z',
    payoutProvider: 'MOCK',
    createdAt: '2026-06-04T00:00:00.000Z', updatedAt: '2026-06-04T00:20:00.000Z', ...over,
  })
  return [
    rmk({ id: 'ord_redeem_done', amount: '100.00', status: 'PAYOUT_COMPLETE' }),
    rmk({
      id: 'ord_redeem_await', amount: '250.00', status: 'AWAITING_BURN',
      userAddress: '', burnTxHash: null, burnedAt: null, payoutRef: null,
      payoutCompletedAt: null, netPayoutIdr: '3905320.00', grossIdr: '3920000.00',
      redeemFeeIdr: '39200.00', totalFeeIdr: '44200.00', estimatedRevenueIdr: '119200.00',
      createdAt: '2026-06-05T00:00:00.000Z', updatedAt: '2026-06-05T00:00:00.000Z',
    }),
  ]
}

// ── USDX-547 — partner-owned orders ─────────────────────────────────────────
// Seeded ALONGSIDE the retail rows, because the mixed population is exactly the
// situation the Partner column and the Owner filter exist for.

export const PARTNER_JUARA: MockOrderPartner = {
  id: '00000000-0000-7000-8000-0000000000b1',
  code: 'juara',
  displayName: 'PT Juara Remiten Indonesia',
}

/**
 * Two shapes, because they differ in the DATA and both must render correctly:
 *
 *   CUSTOMER → owner is a `partner_customers` row with no `users` row at all, so
 *              `user_id` is NULL and `userEmail` is the `(partner customer)`
 *              marker (USDX-571).
 *   SELF     → the partner mints for itself; it DOES have a `users` row, so a
 *              real email is present — and the row must STILL count as a partner
 *              order, because partner-ness is `partner_id`, not the marker.
 */
export function seedPartnerOrders(): MockOrder[] {
  const base = seedOrders()[0]!
  return [
    {
      ...base,
      id: 'ord_partner_cust',
      amount: '750.00',
      userId: null,
      userEmail: '(partner customer)',
      partner: PARTNER_JUARA,
      onBehalfOf: 'CUSTOMER',
      partnerCustomerId: 'pc_e2e_0001',
      externalReference: 'JUARA-ORD-2026-000042',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:10:00.000Z',
    },
    {
      ...base,
      id: 'ord_partner_self',
      amount: '300.00',
      userId: 'usr_partner_legal',
      userEmail: 'ops@juara.co.id',
      partner: PARTNER_JUARA,
      onBehalfOf: 'SELF',
      partnerCustomerId: null,
      externalReference: 'JUARA-ORD-2026-000043',
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:10:00.000Z',
    },
  ]
}

// ── KYC review (USDX-154/155 — sot/api/kyc.yaml) ─────────────────────────────

export interface MockKycRecord {
  id: string
  userId: string
  userEmail: string
  entityType: 'INDIVIDUAL' | 'LEGAL_ENTITY'
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  submissionCount: number
  firstName: string
  lastName: string
  dob: string
  birthPlace: string
  identityType: 'KTP'
  identityNumber: string
  country: string
  addressLine1: string
  addressLine2: string | null
  ktpPhotoUrl: string
  selfiePhotoUrl: string
  // USDX-587 — identitas Pasal 25 (1) a angka 1. `nationality` BUKAN duplikat
  // `country`: yang satu kewarganegaraan orangnya, yang satu negara alamatnya.
  nationality: string | null
  gender: string | null
  maritalStatus: string | null
  /** PII — ADMIN only. Masih dipakai banyak layanan keuangan sebagai jawaban verifikasi telepon. */
  mothersMaidenName: string | null
  /** PII — butir a), "jika ada". */
  aliasName: string | null
  // USDX-545 — CDD block. Nullable across the board: every customer VERIFIED
  // before that ticket has an empty block, and the review page must render the
  // gap rather than assume presence.
  occupation: string | null
  sourceOfFunds: string | null
  annualIncomeRange: string | null
  transactionPurpose: string | null
  /** USDX-587 — separuh kedua Pasal 25 (1) a angka 4. */
  netWorthRange: string | null
  /** USDX-587 — Pasal 37 (1) d, wajib hanya untuk PEP. */
  sourceOfWealth: string | null
  /** PII — Pasal 25 (1) a angka 1 butir g). */
  employerAddress: string | null
  /** PII — butir yang sama dengan `employerAddress`. */
  employerPhone: string | null
  /** PII — reviewer roles only in the UI (`canReviewCustomerPii`, USDX-610). */
  npwp: string | null
  pepStatus: boolean | null
  /** PII — names a real person and their office. */
  pepRelation: string | null
  rejectionReason: string | null
  submittedAt: string
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

interface MockKycReview {
  id: string
  action: 'SUBMITTED' | 'VIEWED' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED' | 'PURGED'
  actorStaffId: string | null
  actorStaffName: string | null
  actorUserId: string | null
  reason: string | null
  ipAddress: string | null
  createdAt: string
}

// Presigned-photo stand-in host (mirrors the live Railway Bucket host so the
// CSP `img-src https://*.storageapi.dev` allowance is exercised). Specs stub
// this host with a 1×1 PNG via page.route.
export const KYC_PHOTO_HOST = 'https://t3.storageapi.dev'

function kycListItem(k: MockKycRecord) {
  return {
    id: k.id, userId: k.userId, userEmail: k.userEmail, entityType: k.entityType,
    status: k.status, submissionCount: k.submissionCount, submittedAt: k.submittedAt,
    reviewedAt: k.reviewedAt, reviewedByName: k.reviewedByName,
  }
}

function seedKyc(): MockKycRecord[] {
  const mk = (over: Partial<MockKycRecord>): MockKycRecord => ({
    id: over.id!, userId: `usr_${over.id}`, userEmail: over.userEmail ?? 'user@example.com',
    entityType: 'INDIVIDUAL', status: 'PENDING', submissionCount: 1,
    firstName: 'Alice', lastName: 'Anderson', dob: '1995-03-15', birthPlace: 'Jakarta',
    identityType: 'KTP', identityNumber: '3171234567890123', country: 'ID',
    addressLine1: 'Jl. Sudirman No. 1', addressLine2: null,
    ktpPhotoUrl: `${KYC_PHOTO_HOST}/e2e/${over.id}/ktp.png`,
    selfiePhotoUrl: `${KYC_PHOTO_HOST}/e2e/${over.id}/selfie.png`,
    // USDX-587 identitas Pasal 25 (1) a angka 1.
    nationality: 'ID', gender: 'PEREMPUAN', maritalStatus: 'BELUM_KAWIN',
    mothersMaidenName: 'Siti Rohmah', aliasName: null,
    // USDX-545 CDD block, populated by default so the E2E review screen shows
    // what a real submission looks like after the ticket. `occupation` is a
    // Permendagri value since USDX-584 — the five old ones no longer exist.
    occupation: 'PEGAWAI_NEGERI_SIPIL', sourceOfFunds: 'BUSINESS',
    annualIncomeRange: 'FROM_500M_TO_1B', transactionPurpose: 'REMITTANCE',
    netWorthRange: 'FROM_500M_TO_2B', sourceOfWealth: 'SALARY_ACCUMULATION',
    employerAddress: 'Jl. Gatot Subroto No. 12, Jakarta Selatan',
    employerPhone: '02170000001',
    npwp: '123456789012345', pepStatus: false, pepRelation: null,
    rejectionReason: null, submittedAt: '2026-06-01T03:00:00.000Z',
    reviewedBy: null, reviewedByName: null, reviewedAt: null,
    createdAt: '2026-06-01T03:00:00.000Z', updatedAt: '2026-06-01T03:00:00.000Z',
    ...over,
  })
  return [
    // PENDING is the OLDEST on purpose — the list sorts submitted_at ascending,
    // so specs can assert it lands on row #1 (oldest pending first).
    mk({ id: 'kyc_pending', userEmail: 'alice.pending@example.com' }),
    mk({
      id: 'kyc_verified', userEmail: 'bob.verified@example.com', status: 'VERIFIED',
      firstName: 'Bob', lastName: 'Martin', submittedAt: '2026-06-05T03:00:00.000Z',
      reviewedBy: ADMIN_STAFF.id, reviewedByName: ADMIN_STAFF.name, reviewedAt: '2026-06-06T03:00:00.000Z',
    }),
    mk({
      id: 'kyc_rejected', userEmail: 'cindy.rejected@example.com', status: 'REJECTED',
      firstName: 'Cindy', lastName: 'Lestari', submissionCount: 2, submittedAt: '2026-06-08T03:00:00.000Z',
      rejectionReason: 'Foto KTP buram', reviewedBy: ADMIN_STAFF.id,
      reviewedByName: ADMIN_STAFF.name, reviewedAt: '2026-06-09T03:00:00.000Z',
    }),
  ]
}

function seedKycReviews(records: MockKycRecord[]): Map<string, MockKycReview[]> {
  let n = 0
  const mk = (over: Partial<MockKycReview>): MockKycReview => ({
    id: `rev_${++n}`, action: 'SUBMITTED', actorStaffId: null, actorStaffName: null,
    actorUserId: null, reason: null, ipAddress: null, createdAt: '2026-06-01T03:00:00.000Z', ...over,
  })
  const map = new Map<string, MockKycReview[]>()
  for (const k of records) {
    const rows: MockKycReview[] = [mk({ action: 'SUBMITTED', actorUserId: k.userId, createdAt: k.createdAt })]
    if (k.status !== 'PENDING') {
      rows.unshift(
        mk({
          action: k.status === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
          actorStaffId: k.reviewedBy, actorStaffName: k.reviewedByName,
          reason: k.rejectionReason, createdAt: k.reviewedAt ?? k.updatedAt,
        })
      )
    }
    map.set(k.id, rows)
  }
  return map
}

type RouteOverride = (route: Route, url: URL) => Promise<boolean | void> | boolean | void

export interface MockApiOptions {
  /** Pre-seed extra users into the directory. */
  users?: (typeof VERIFIED_USER)[]
  /** Replace the seeded request list. */
  requests?: MockRequest[]
  /** Replace the seeded KYC records (USDX-154/155). */
  kyc?: MockKycRecord[]
  /** Replace the seeded consumer orders (USDX-206). */
  orders?: MockOrder[]
  /** Override a single endpoint, keyed by `"METHOD /api/v1/path"`. Return `true` if handled. */
  routes?: Record<string, RouteOverride>
}

export interface MockApiState {
  users: (typeof VERIFIED_USER)[]
  requests: MockRequest[]
  orders: MockOrder[]
  kyc: MockKycRecord[]
  kycReviews: Map<string, MockKycReview[]>
  /** USDX-156 — last resend-activation timestamp per user id (cooldown). */
  resendLog: Map<string, number>
}

export async function installMockApi(page: Page, opts: MockApiOptions = {}): Promise<MockApiState> {
  const kycRecords = opts.kyc ?? seedKyc()
  const state: MockApiState = {
    users: [VERIFIED_USER, PENDING_ACTIVATION_USER, FAILED_ACTIVATION_USER, ...(opts.users ?? [])],
    requests: opts.requests ?? seedRequests(),
    orders: opts.orders ?? seedOrders(),
    kyc: kycRecords,
    kycReviews: seedKycReviews(kycRecords),
    resendLog: new Map(),
  }

  // USDX-207: per-test mutable rate + fee config so POST is reflected by the
  // next GET (the FE invalidates and refetches after a successful update).
  let liveRate = { ...RATE_INFO }
  let liveFee = { ...FEE_CONFIG }

  const envelope = (route: Route, data: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data }) })
  const paginated = (route: Route, items: unknown[], pageNum: number, limit: number) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ status: 'success', metadata: { page: pageNum, limit, total: items.length }, data: items.slice((pageNum - 1) * limit, pageNum * limit) }),
    })
  const error = (route: Route, code: string, message: string, status: number) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code, message } }) })
  const noContent = (route: Route) => route.fulfill({ status: 204, body: '' })

  await page.route(
    (u) => u.pathname.startsWith('/api/v1/'),
    async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()
    const key = `${method} ${path}`
    const body = () => { try { return JSON.parse(req.postData() ?? '{}') } catch { return {} } }

    const override = opts.routes?.[key]
    if (override) { const handled = await override(route, url); if (handled === true) return }

    // ── Auth ──────────────────────────────────────────────────────────────
    if (key === 'POST /api/v1/auth/login') {
      const b = body()
      if (!b.email || !b.password) return error(route, 'VALIDATION_ERROR', 'Email and password are required', 400)
      if (b.password !== 'admin123456' && b.password !== MOCK_TOKEN) return error(route, 'UNAUTHORIZED', 'Invalid credentials', 401)
      // USDX-392: set the httpOnly session cookie (primary auth) + keep the
      // backward-compat accessToken in the body.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': `usdx_session=${MOCK_TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800` },
        body: JSON.stringify({ status: 'success', metadata: null, data: { accessToken: MOCK_TOKEN, staff: { ...ADMIN_STAFF, email: b.email } } }),
      })
    }
    if (key === 'GET /api/v1/auth/me') {
      // USDX-392: authenticate via the session cookie (Bearer still accepted).
      const auth = req.headers()['authorization'] ?? ''
      const cookie = req.headers()['cookie'] ?? ''
      const authed = auth.startsWith('Bearer ') || /(?:^|;\s*)usdx_session=/.test(cookie)
      if (!authed) return error(route, 'UNAUTHORIZED', 'UNAUTHORIZED', 401)
      return envelope(route, ADMIN_STAFF)
    }
    // USDX-392: server-side logout — clear the cookie and return success.
    if (key === 'POST /api/v1/auth/logout') {
      return route.fulfill({
        status: 204,
        headers: { 'set-cookie': 'usdx_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' },
        body: '',
      })
    }

    // ── Dashboard / rate / chains / threshold ─────────────────────────────
    if (key === 'GET /api/v1/dashboard/stats') return envelope(route, DASHBOARD_STATS)
    if (key === 'GET /api/v1/rate') return envelope(route, liveRate)
    // USDX-207: rate update (spread beli/jual). Recompute effective rates so the
    // refetched GET shows the new spreads in the card.
    if (key === 'POST /api/v1/rate') {
      const b = body()
      const base =
        b.mode === 'MANUAL' && b.manualRate
          ? Number.parseFloat(b.manualRate)
          : Number.parseFloat(liveRate.baseRate)
      const buy = Number.parseFloat(b.spreadBuyPct ?? '0') || 0
      const sell = Number.parseFloat(b.spreadSellPct ?? '0') || 0
      liveRate = {
        baseRate: base.toFixed(4),
        mode: b.mode,
        spreadBuyPct: b.spreadBuyPct ?? '0',
        spreadSellPct: b.spreadSellPct ?? '0',
        effectiveBuyRate: (base * (1 + buy / 100)).toFixed(4),
        effectiveSellRate: (base * (1 - sell / 100)).toFixed(4),
        updatedAt: '2026-06-17T00:00:00.000Z',
      }
      return envelope(route, { id: 'rate-live', updatedBy: ADMIN_STAFF.id, createdAt: liveRate.updatedAt, ...b }, 201)
    }
    // USDX-207: fee config (sot/api/fee.yaml). GET all roles, POST admin.
    if (key === 'GET /api/v1/fee-config') return envelope(route, liveFee)
    if (key === 'POST /api/v1/fee-config') {
      const b = body()
      // Full 5-field snapshot, all required + non-negative (USDX-245). Body
      // failures → 422 VALIDATION_ERROR (fee-config on the v1→422 allowlist).
      for (const f of [
        'mintFeePct',
        'pgFeeVaFlat',
        'pgFeeQrisPct',
        'redeemFeePct',
        'disbursementFeeFlat',
      ]) {
        const n = Number(b[f])
        if (b[f] == null || b[f] === '' || !Number.isFinite(n) || n < 0) {
          return error(route, 'VALIDATION_ERROR', `${f} is required`, 422)
        }
      }
      liveFee = {
        id: 'fee-live',
        mintFeePct: b.mintFeePct,
        pgFeeVaFlat: b.pgFeeVaFlat,
        pgFeeQrisPct: b.pgFeeQrisPct,
        redeemFeePct: b.redeemFeePct,
        disbursementFeeFlat: b.disbursementFeeFlat,
        updatedBy: ADMIN_STAFF.id,
        createdAt: '2026-06-17T00:00:00.000Z',
      }
      return envelope(route, liveFee, 201)
    }
    if (key === 'GET /api/v1/chains') return envelope(route, [POLYGON_CHAIN])
    if (key === 'GET /api/v1/threshold') return envelope(route, THRESHOLD)
    if (key === 'GET /api/v1/staff') return paginated(route, [ADMIN_STAFF], 1, 50)

    // ── Users ─────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/api/v1/users') {
      const search = url.searchParams.get('search')?.toLowerCase()
      const kyc = url.searchParams.get('kycStatus')
      const entity = url.searchParams.get('entityType')
      const activation = url.searchParams.get('activationStatus')
      let list = [...state.users]
      if (search) list = list.filter((u) => (u.name ?? '').toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
      if (kyc) list = list.filter((u) => u.kycStatus === kyc)
      if (entity) list = list.filter((u) => u.entityType === entity)
      // USDX-156 — users.yaml § activationStatus semantics
      if (activation === 'PENDING') list = list.filter((u) => u.emailVerifiedAt === null)
      if (activation === 'ACTIVATED') list = list.filter((u) => u.emailVerifiedAt !== null)
      if (activation === 'FAILED') list = list.filter((u) => u.activationEmailFailedAt !== null)
      return paginated(route, list, Number(url.searchParams.get('page') ?? '1'), Number(url.searchParams.get('limit') ?? '20'))
    }
    if (key === 'POST /api/v1/users') {
      const b = body()
      if (state.users.some((u) => u.email.toLowerCase() === String(b.email ?? '').toLowerCase())) return error(route, 'CONFLICT', 'A user with this email already exists', 409)
      // USDX-156: Phase 2 create — no password anywhere; user starts
      // unverified and BE queues the activation email (admin-created.html).
      const created = {
        id: `usr_${Date.now()}`, name: b.name, email: b.email, phone: b.phone ?? null,
        entityType: b.entityType ?? 'INDIVIDUAL',
        kycStatus: 'UNVERIFIED' as const, suspended: false,
        emailVerifiedAt: null, activationEmailFailedAt: null,
        notes: b.notes ?? null, wallets: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      state.users.unshift(created as never)
      return envelope(route, created, 201)
    }
    // USDX-156 — POST /api/v1/users/:id/resend-activation (admin only).
    // 60s per-user cooldown; 409 once the user has verified.
    const resendMatch = path.match(/^\/api\/v1\/users\/([^/]+)\/resend-activation$/)
    if (method === 'POST' && resendMatch) {
      const u = state.users.find((x) => x.id === resendMatch[1])
      if (!u) return error(route, 'NOT_FOUND', 'User not found', 404)
      if (u.emailVerifiedAt !== null) return error(route, 'ALREADY_VERIFIED', 'User sudah verify email', 409)
      const last = state.resendLog.get(u.id) ?? 0
      if (Date.now() - last < 60_000) return error(route, 'TOO_MANY_REQUESTS', 'Cooldown 60 detik per user', 429)
      state.resendLog.set(u.id, Date.now())
      return envelope(route, { activationEmailSent: true })
    }

    const userIdMatch = path.match(/^\/api\/v1\/users\/([^/]+)$/)
    if (userIdMatch) {
      const id = userIdMatch[1]
      const idx = state.users.findIndex((u) => u.id === id)
      if (method === 'GET') {
        if (idx < 0) return error(route, 'NOT_FOUND', 'User not found', 404)
        return envelope(route, { ...state.users[idx], analytics: { totalMinted: '0', totalBurned: '0', totalTransactions: 0 }, recentRequests: [] })
      }
      if (method === 'PATCH') {
        if (idx < 0) return error(route, 'NOT_FOUND', 'User not found', 404)
        state.users[idx] = { ...state.users[idx], ...body(), updatedAt: new Date().toISOString() }
        return envelope(route, state.users[idx])
      }
      if (method === 'DELETE') {
        state.users = state.users.filter((u) => u.id !== id)
        return noContent(route)
      }
    }

    // ── Screening results (USDX-588) — dibaca panel status di modal review
    //    KYC & KYB (USDX-610). Bentuk barisnya persis kontraknya, TERMASUK yang
    //    menentukan seluruh perilaku panelnya: baris `LIST_UNAVAILABLE` membawa
    //    `listId: null` DAN `listType: null`, karena tabelnya memang tidak
    //    menyimpan jenis daftar untuk hasil itu.
    if (method === 'GET' && path === '/api/v1/screening/results') {
      const subjectId = url.searchParams.get('subjectId') ?? ''
      const rows = subjectId
        ? [
            {
              id: `scr_${subjectId}_dttot`,
              subjectType: url.searchParams.get('subjectType') ?? 'KYC',
              subjectId,
              outcome: 'NO_MATCH',
              score: 0.1042,
              matchedName: null,
              matchCount: 0,
              trigger: 'KYC_SUBMIT',
              listId: 'lst_dttot_1',
              listType: 'DTTOT',
              listPublishedAt: '2026-08-16',
              decision: null,
              createdAt: '2026-09-02T08:56:58.000Z',
            },
            {
              id: `scr_${subjectId}_unavailable`,
              subjectType: url.searchParams.get('subjectType') ?? 'KYC',
              subjectId,
              outcome: 'LIST_UNAVAILABLE',
              score: null,
              matchedName: null,
              matchCount: null,
              trigger: 'KYC_SUBMIT',
              listId: null,
              listType: null,
              listPublishedAt: null,
              decision: null,
              createdAt: '2026-09-02T08:56:58.000Z',
            },
          ]
        : []
      return paginated(route, rows, 1, 100)
    }

    // ── KYC review list / detail / actions (USDX-154/155) ────────────────
    if (method === 'GET' && path === '/api/v1/kyc') {
      const status = url.searchParams.get('status')
      const entity = url.searchParams.get('entityType')
      const search = url.searchParams.get('search')?.toLowerCase()
      let list = [...state.kyc]
      if (status) list = list.filter((k) => k.status === status)
      if (entity) list = list.filter((k) => k.entityType === entity)
      if (search) list = list.filter((k) => k.userEmail.toLowerCase().includes(search))
      // Contract: fixed submitted_at ascending (oldest pending first).
      list.sort((a, b) => (a.submittedAt > b.submittedAt ? 1 : -1))
      return paginated(route, list.map(kycListItem), Number(url.searchParams.get('page') ?? '1'), Number(url.searchParams.get('limit') ?? '10'))
    }
    const kycReviewsMatch = path.match(/^\/api\/v1\/kyc\/([^/]+)\/reviews$/)
    if (method === 'GET' && kycReviewsMatch) {
      const rows = state.kycReviews.get(kycReviewsMatch[1])
      if (!rows) return error(route, 'NOT_FOUND', 'KYC record not found', 404)
      return envelope(route, rows)
    }
    const kycActionMatch = path.match(/^\/api\/v1\/kyc\/([^/]+)\/(approve|reject)$/)
    if (method === 'POST' && kycActionMatch) {
      const k = state.kyc.find((x) => x.id === kycActionMatch[1])
      if (!k) return error(route, 'NOT_FOUND', 'KYC record not found', 404)
      if (k.status !== 'PENDING') return error(route, 'INVALID_STATUS', 'KYC status is not PENDING', 409)
      const now = new Date().toISOString()
      if (kycActionMatch[2] === 'approve') {
        k.status = 'VERIFIED'
      } else {
        const reason = String(body().reason ?? '').trim()
        // USDX-610 — 10, bukan 1. Tiruan yang lebih longgar dari servernya membuat
        // e2e hijau atas permintaan yang backend tolak 400.
        if (reason.length < 10 || reason.length > 500) return error(route, 'BAD_REQUEST', 'reason must be 10-500 characters', 400)
        k.status = 'REJECTED'
        k.rejectionReason = reason
      }
      k.reviewedBy = ADMIN_STAFF.id
      k.reviewedByName = ADMIN_STAFF.name
      k.reviewedAt = now
      k.updatedAt = now
      state.kycReviews.get(k.id)?.unshift({
        id: `rev_live_${Date.now()}`, action: k.status === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
        actorStaffId: ADMIN_STAFF.id, actorStaffName: ADMIN_STAFF.name, actorUserId: null,
        reason: k.rejectionReason, ipAddress: null, createdAt: now,
      })
      return envelope(route, kycListItem(k))
    }
    const kycIdMatch = path.match(/^\/api\/v1\/kyc\/([^/]+)$/)
    if (method === 'GET' && kycIdMatch) {
      const k = state.kyc.find((x) => x.id === kycIdMatch[1])
      if (!k) return error(route, 'NOT_FOUND', 'KYC record not found', 404)
      // Audit-first: every detail GET records a VIEWED row (kyc.yaml § detail).
      state.kycReviews.get(k.id)?.unshift({
        id: `rev_viewed_${Date.now()}`, action: 'VIEWED', actorStaffId: ADMIN_STAFF.id,
        actorStaffName: ADMIN_STAFF.name, actorUserId: null, reason: null, ipAddress: null,
        createdAt: new Date().toISOString(),
      })
      // Presigned URLs are minted per request — fresh 5-minute TTL.
      return envelope(route, { ...k, urlExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() })
    }

    // ── Requests list / detail ────────────────────────────────────────────
    if (method === 'GET' && path === '/api/v1/requests') {
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const chain = url.searchParams.get('chain')
      const safeType = url.searchParams.get('safeType')
      const search = url.searchParams.get('search')?.toLowerCase()
      let list = [...state.requests]
      if (type === 'mint' || type === 'burn') list = list.filter((r) => r.type === type)
      if (status) list = list.filter((r) => r.status === status)
      if (chain) list = list.filter((r) => r.chain === chain)
      if (safeType === 'STAFF' || safeType === 'MANAGER') list = list.filter((r) => r.safeType === safeType)
      if (search) list = list.filter((r) => r.userName.toLowerCase().includes(search) || r.userAddress.toLowerCase().includes(search))
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return paginated(route, list.map(listItem), Number(url.searchParams.get('page') ?? '1'), Number(url.searchParams.get('limit') ?? '20'))
    }
    const reqIdMatch = path.match(/^\/api\/v1\/requests\/([^/]+)$/)
    if (method === 'GET' && reqIdMatch) {
      const r = state.requests.find((x) => x.id === reqIdMatch[1])
      if (!r) return error(route, 'NOT_FOUND', 'Request not found', 404)
      return envelope(route, detailItem(r))
    }

    // ── Mint / burn submission ────────────────────────────────────────────
    if (key === 'POST /api/v1/mint' || key === 'POST /api/v1/burn') {
      const b = body()
      const type = key.endsWith('mint') ? 'mint' : 'burn'
      const id = `${type}_${Date.now()}`
      const usdx = b.amountCurrency === 'IDR'
        ? (Number.parseFloat(b.amount) / Number.parseFloat(RATE_USED)).toFixed(6)
        : Number.parseFloat(b.amount).toFixed(6)
      const idr = b.amountCurrency === 'IDR'
        ? Number.parseFloat(b.amount).toFixed(2)
        : (Number.parseFloat(usdx) * Number.parseFloat(RATE_USED)).toFixed(2)
      const u = state.users.find((x) => x.id === b.userId)
      const created: MockRequest = {
        id, type, idempotencyKey: HEX64('1'), userId: b.userId, userName: u?.name ?? 'Unknown',
        userAddress: b.userAddress, amount: usdx, amountWei: String(Math.round(Number.parseFloat(usdx) * 1e6)),
        amountIdr: idr, inputCurrency: b.amountCurrency, rateUsed: RATE_USED, chain: b.chain,
        notes: b.notes ?? null, safeType: Number(idr) >= 1_000_000_000 ? 'MANAGER' : 'STAFF', status: 'PENDING_APPROVAL',
        safeTxHash: HEX64('e'), onChainTxHash: null, createdBy: ADMIN_STAFF.id,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        ...(type === 'burn' ? { depositTxHash: b.depositTxHash, bankName: b.bankName, bankAccount: b.bankAccount } : {}),
      }
      state.requests.unshift(created)
      return envelope(route, detailItem(created), 201)
    }

    // ── Consumer orders / "User Transaction" (USDX-206) ──────────────────────
    if (method === 'GET' && path === '/api/v1/orders') {
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const paymentStatus = url.searchParams.get('paymentStatus')
      const safeStatus = url.searchParams.get('safeStatus')
      const userId = url.searchParams.get('userId')
      // USDX-547 — partner vs retail population.
      const ownerType = url.searchParams.get('ownerType')
      if (ownerType !== null && ownerType !== 'PARTNER' && ownerType !== 'RETAIL') {
        return error(route, 'VALIDATION_ERROR', 'ownerType must be PARTNER or RETAIL', 400)
      }
      let list = [...state.orders]
      if (type) list = list.filter((o) => o.type === type)
      if (status) list = list.filter((o) => o.status === status)
      if (paymentStatus) list = list.filter((o) => o.paymentStatus === paymentStatus)
      if (safeStatus) list = list.filter((o) => o.safeStatus === safeStatus)
      if (userId) list = list.filter((o) => o.userId === userId)
      // Decided by `partner_id`, NOT by the `(partner customer)` email marker —
      // a partner's own (SELF) order has a real email and is still a partner order.
      if (ownerType === 'PARTNER') list = list.filter((o) => o.partner !== null)
      if (ownerType === 'RETAIL') list = list.filter((o) => o.partner === null)
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return paginated(
        route,
        list.map(orderListItem),
        Number(url.searchParams.get('page') ?? '1'),
        Number(url.searchParams.get('take') ?? url.searchParams.get('limit') ?? '20'),
      )
    }
    const orderIdMatch = path.match(/^\/api\/v1\/orders\/([^/]+)$/)
    if (method === 'GET' && orderIdMatch) {
      const o = state.orders.find((x) => x.id === orderIdMatch[1])
      if (!o) return error(route, 'NOT_FOUND', 'Order not found', 404)
      return envelope(route, o)
    }

    // ── Fallback ──────────────────────────────────────────────────────────
    return error(route, 'NOT_IMPLEMENTED', `mock-api: unhandled ${key}`, 501)
  })

  return state
}
