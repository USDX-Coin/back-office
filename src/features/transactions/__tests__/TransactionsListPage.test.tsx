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
  chain: 'polygon',
  paymentStatus: 'PAID',
  safeStatus: 'EXECUTED',
  status: 'COMPLETED',
  createdAt: '2026-06-01T00:00:00Z',
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
  totalFeeIdr: '16650.75',
  totalPayIdr: '4086900.75',
  estimatedRevenueIdr: '32310.75',
  safeType: 'STAFF',
  paymentStatus: 'PAID',
  safeStatus: 'EXECUTED',
  status: 'COMPLETED',
  paymentProvider: 'MOCK',
  paidAt: '2026-06-01T00:05:00Z',
  expiresAt: '2026-06-01T01:00:00Z',
  safeTxHash: '0x' + 'b'.repeat(64),
  onChainTxHash: '0x' + 'a'.repeat(64),
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:10:00Z',
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

    test('REDEEM type option is disabled (Week 2 mint-only, union-ready)', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Type' }))
      const redeem = await screen.findByRole('option', { name: /redeem/i })
      expect(redeem).toHaveAttribute('aria-disabled', 'true')
    })
  })
})
