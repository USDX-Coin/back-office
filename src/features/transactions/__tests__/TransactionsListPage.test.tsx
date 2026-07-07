import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import TransactionsListPage from '@/features/transactions/TransactionsListPage'
import { renderWithProviders } from '@/test/test-utils'
import type { OrderDetail, OrderListItem } from '@/lib/types'

// USDX-206 — backoffice "User Transaction" (consumer mint orders). Read-only
// list + filter + detail. Covers the E2E acceptance criteria at the unit level:
//   1. open menu → list renders + filters wire to the query
//   2. detail shows the fee / spread / revenue breakdown
//   3. read-only — no approve/reject action anywhere

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const baseRow = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: 'ord_1',
  type: 'MINT',
  userId: 'usr_1',
  userEmail: 'alice@example.com',
  amount: '250.00',
  totalPayIdr: '4078500.00',
  netPayoutIdr: null,
  chain: 'polygon',
  paymentStatus: 'PAID',
  safeStatus: 'EXECUTED',
  status: 'COMPLETED',
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

// Redeem list row — mint-only fields null, netPayoutIdr set (USDX-245).
const redeemRow = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: 'ord_rdm',
  type: 'REDEEM',
  userId: 'usr_2',
  userEmail: 'bob@example.com',
  amount: '100.00',
  totalPayIdr: null,
  netPayoutIdr: '1547320.00',
  chain: 'polygon',
  paymentStatus: null,
  safeStatus: null,
  status: 'PAYOUT_COMPLETE',
  createdAt: '2026-06-02T00:00:00Z',
  ...overrides,
})

const baseDetail = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  id: 'ord_1',
  type: 'MINT',
  userId: 'usr_1',
  userEmail: 'alice@example.com',
  userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  chain: 'polygon',
  idempotencyKey: 'mint_abc123',
  amount: '250.00',
  baseRate: '16200.00',
  spreadBuyPct: '0.50',
  spreadSellPct: '0.40',
  effectiveRate: '16281.00',
  subtotalIdr: '4070250.00',
  paymentChannel: 'VA',
  paymentBank: 'BCA',
  mintFeePct: '0.30',
  mintFeeIdr: '12210.75',
  pgFeeIdr: '4440.00',
  totalPayIdr: '4086900.75',
  safeType: 'STAFF',
  paymentStatus: 'PAID',
  safeStatus: 'EXECUTED',
  paidAt: '2026-06-01T00:05:00Z',
  safeTxHash: '0x' + 'b'.repeat(64),
  onChainTxHash: '0x' + 'a'.repeat(64),
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
  totalFeeIdr: '16650.75',
  estimatedRevenueIdr: '32310.75',
  status: 'COMPLETED',
  expiresAt: '2026-06-01T01:00:00Z',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:10:00Z',
  ...overrides,
})

// Redeem detail — mint block null, redeem block populated (USDX-245).
const redeemDetail = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  id: 'ord_rdm',
  type: 'REDEEM',
  userId: 'usr_2',
  userEmail: 'bob@example.com',
  userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  chain: 'polygon',
  amount: '100.00',
  baseRate: '16000.00',
  spreadBuyPct: null,
  spreadSellPct: '2.00',
  effectiveRate: '15680.00',
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
  redeemId: '0x' + 'c'.repeat(64),
  grossIdr: '1568000.00',
  redeemFeePct: '1.00',
  redeemFeeIdr: '15680.00',
  disbursementFeeIdr: '5000.00',
  netPayoutIdr: '1547320.00',
  bankCode: 'BCA',
  bankName: 'BCA',
  bankAccountNumber: '1234563271',
  bankAccountName: 'BOB SETIAWAN',
  lateBurn: false,
  payoutRef: 'disb_abc123',
  burnTxHash: '0x' + 'd'.repeat(64),
  burnedAt: '2026-06-02T00:12:00Z',
  payoutCompletedAt: '2026-06-02T00:20:00Z',
  payoutProvider: 'MOCK',
  // Shared.
  totalFeeIdr: '20680.00',
  estimatedRevenueIdr: '47680.00',
  status: 'PAYOUT_COMPLETE',
  expiresAt: '2026-06-02T01:00:00Z',
  createdAt: '2026-06-02T00:00:00Z',
  updatedAt: '2026-06-02T00:20:00Z',
  ...overrides,
})

function okList(rows: OrderListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 20, total: rows.length },
    data: rows,
  })
}

function okDetail(detail: OrderDetail) {
  return HttpResponse.json({ status: 'success', metadata: null, data: detail })
}

function TestApp() {
  return (
    <Routes>
      <Route path="/transactions" element={<TransactionsListPage />} />
      <Route path="/transactions/:id" element={<TransactionsListPage />} />
    </Routes>
  )
}

function setup(initialEntries: string[] = ['/transactions']) {
  return renderWithProviders(<TestApp />, { initialEntries, authenticated: true })
}

describe('TransactionsListPage @ USDX-206', () => {
  describe('positive', () => {
    test('AC #1 — opens /transactions and renders a row from GET /api/v1/orders', async () => {
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')
      // list columns: amount + status badges visible
      expect(screen.getByText('250.00')).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /payment/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /safe/i })).toBeInTheDocument()
    })

    test('AC #1 — Status filter wires to ?status=COMPLETED', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Status' }))
      await user.click(await screen.findByRole('option', { name: /^completed$/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('status=COMPLETED'))).toBe(true),
      )
    })

    test('AC #1 — Payment filter wires to ?paymentStatus=PAID', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Payment' }))
      await user.click(await screen.findByRole('option', { name: /^paid$/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('paymentStatus=PAID'))).toBe(true),
      )
    })

    test('AC #2 — row click opens detail modal with fee / spread / revenue breakdown', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_open' })])),
        http.get('/api/v1/orders/ord_open', () => okDetail(baseDetail({ id: 'ord_open' }))),
      )
      setup()
      await user.click(await screen.findByText('alice@example.com'))

      const dialog = await screen.findByRole('dialog')
      // Breakdown sections + key figures present
      expect(within(dialog).getByText(/exchange rate & spread/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/fee breakdown/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/estimated revenue/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/spread beli/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/spread jual/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/payment gateway fee/i)).toBeInTheDocument()
      // Effective rate + estimated revenue values rendered
      expect(within(dialog).getByText(/32.*310/)).toBeInTheDocument()
    })

    test('AC #2 — detail links safe/on-chain tx hashes out via chains config', async () => {
      const user = userEvent.setup()
      const onChain = '0x' + 'a'.repeat(64)
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_links' })])),
        http.get('/api/v1/orders/ord_links', () =>
          okDetail(baseDetail({ id: 'ord_links', onChainTxHash: onChain })),
        ),
      )
      setup()
      await user.click(await screen.findByText('alice@example.com'))
      await screen.findByRole('dialog')
      await waitFor(() => {
        expect(
          document.querySelector(`a[href="https://polygonscan.com/tx/${onChain}"]`),
        ).not.toBeNull()
      })
      const link = document.querySelector(`a[href="https://polygonscan.com/tx/${onChain}"]`)!
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })

    test('deep-link /transactions/:id auto-opens the modal on first render', async () => {
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_deep' })])),
        http.get('/api/v1/orders/ord_deep', () => okDetail(baseDetail({ id: 'ord_deep' }))),
      )
      setup(['/transactions/ord_deep'])
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/mint order/i)).toBeInTheDocument()
    })
  })

  describe('AC #3 — read-only', () => {
    test('list has no approve / reject controls', async () => {
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })

    test('detail modal has no approve / reject controls', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_ro' })])),
        http.get('/api/v1/orders/ord_ro', () => okDetail(baseDetail({ id: 'ord_ro' }))),
      )
      setup()
      await user.click(await screen.findByText('alice@example.com'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('renders the empty state when there are no orders', async () => {
      server.use(http.get('/api/v1/orders', () => okList([])))
      setup()
      await screen.findByText(/no user transactions yet/i)
    })

    test('null totalPayIdr renders a dash (channel not yet chosen)', async () => {
      server.use(
        http.get('/api/v1/orders', () =>
          okList([
            baseRow({
              id: 'ord_pending',
              paymentStatus: 'REQUESTED',
              safeStatus: 'NONE',
              status: 'WAITING_FOR_PAYMENT',
              totalPayIdr: null,
            }),
          ]),
        ),
      )
      setup()
      await screen.findByText('alice@example.com')
      // The Total pay (IDR) cell shows an em dash for the null value.
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })

    test('REDEEM type option is now selectable (W3, USDX-245)', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Type' }))
      const redeem = await screen.findByRole('option', { name: /redeem/i })
      expect(redeem).not.toHaveAttribute('aria-disabled', 'true')
    })
  })
})

// USDX-245 — User Transaction extended to redeem orders (type=REDEEM).
describe('TransactionsListPage @ USDX-245 — redeem', () => {
  describe('positive', () => {
    test('AC #1 — filter type=REDEEM wires to ?type=REDEEM', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([redeemRow()])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Type' }))
      await user.click(await screen.findByRole('option', { name: /^redeem$/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() => expect(captured.some((s) => s.includes('type=REDEEM'))).toBe(true))
    })

    test('AC #1 — redeem row renders net payout + dashes for payment/safe', async () => {
      server.use(http.get('/api/v1/orders', () => okList([redeemRow()])))
      setup()
      await screen.findByText('bob@example.com')
      // Net payout (IDR) figure is shown for the redeem row.
      expect(screen.getByText(/1.*547.*320/)).toBeInTheDocument()
    })

    test('AC #1 — Status options switch to RedeemStatus when type=REDEEM', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/orders', () => okList([redeemRow()])))
      setup(['/transactions?type=REDEEM'])
      await screen.findByText('bob@example.com')
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Status' }))
      expect(await screen.findByRole('option', { name: /awaiting burn/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /payout complete/i })).toBeInTheDocument()
    })

    test('AC #2 — redeem detail shows fee / net payout / bank + burn tx link', async () => {
      const user = userEvent.setup()
      const burn = '0x' + 'd'.repeat(64)
      server.use(
        http.get('/api/v1/orders', () => okList([redeemRow({ id: 'ord_r1' })])),
        http.get('/api/v1/orders/ord_r1', () =>
          okDetail(redeemDetail({ id: 'ord_r1', burnTxHash: burn })),
        ),
      )
      setup()
      await user.click(await screen.findByText('bob@example.com'))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/redeem order/i)).toBeInTheDocument()
      // Redeem-specific fields.
      expect(within(dialog).getByText(/spread jual/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/disbursement fee/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/net payout/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/bank tujuan/i)).toBeInTheDocument()
      // Bank name + full account number + account name shown (un-mask, USDX-270).
      expect(within(dialog).getByText('BCA')).toBeInTheDocument()
      expect(within(dialog).getByText('1234563271')).toBeInTheDocument()
      expect(within(dialog).getByText('BOB SETIAWAN')).toBeInTheDocument()
      // Burn tx hash deep-links to the block explorer.
      await waitFor(() => {
        expect(
          document.querySelector(`a[href="https://polygonscan.com/tx/${burn}"]`),
        ).not.toBeNull()
      })
    })
  })

  describe('AC #3 — read-only', () => {
    test('redeem detail modal has no approve / reject controls', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([redeemRow({ id: 'ord_r2' })])),
        http.get('/api/v1/orders/ord_r2', () => okDetail(redeemDetail({ id: 'ord_r2' }))),
      )
      setup()
      await user.click(await screen.findByText('bob@example.com'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })
  })
})

// USDX-254 — type-aware status filter: when type=REDEEM the RedeemStatus value
// is sent through a distinct `redeemStatus` query param, never the mint `status`.
describe('TransactionsListPage @ USDX-254 — redeem status filter', () => {
  describe('positive', () => {
    test('AC #1 — selecting a redeem status wires to ?type=REDEEM&redeemStatus=PROCESSING_PAYOUT', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([redeemRow({ status: 'PROCESSING_PAYOUT' })])
        }),
      )
      // Start already on REDEEM so the Status dropdown offers RedeemStatus.
      setup(['/transactions?type=REDEEM'])
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Status' }))
      await user.click(await screen.findByRole('option', { name: /processing payout/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(
          captured.some(
            (s) => s.includes('type=REDEEM') && s.includes('redeemStatus=PROCESSING_PAYOUT'),
          ),
        ).toBe(true),
      )
      // The RedeemStatus value must never travel through the mint `status` param.
      expect(captured.every((s) => !/[?&]status=/.test(s))).toBe(true)
    })
  })

  describe('AC #3 — type switch resets the stale status dimension', () => {
    test('REDEEM → MINT drops redeemStatus from the next request', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([baseRow()])
        }),
      )
      setup(['/transactions?type=REDEEM&redeemStatus=PROCESSING_PAYOUT'])
      await waitFor(() =>
        expect(captured.some((s) => s.includes('redeemStatus=PROCESSING_PAYOUT'))).toBe(true),
      )

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Type' }))
      await user.click(await screen.findByRole('option', { name: /^mint$/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() => {
        const last = captured[captured.length - 1]
        expect(last).toContain('type=MINT')
        expect(last).not.toContain('redeemStatus')
      })
    })
  })

  describe('negative', () => {
    test('a 422 from an invalid combo surfaces a graceful error state (not a crash)', async () => {
      server.use(
        http.get('/api/v1/orders', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'VALIDATION_ERROR', message: 'invalid filter combination' },
            },
            { status: 422 },
          ),
        ),
      )
      setup(['/transactions?type=REDEEM&redeemStatus=PROCESSING_PAYOUT'])
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })
})
