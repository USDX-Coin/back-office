import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import BurnListPage from '@/features/burn/BurnListPage'
import { renderWithProviders } from '@/test/test-utils'
import type { RequestListItem } from '@/lib/types'

// USDX-52 — Burn list page (separated from form). Covers AC #1, #2, #3, #5,
// plus the search wiring delta (scope says "Search" as separate item; the
// USDX-50 toolbar shipped the input but it was not threaded into the query).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const baseRow = (overrides: Partial<RequestListItem>): RequestListItem => ({
  id: 'req_1',
  type: 'burn',
  userId: 'usr_1',
  userName: 'Alice Anderson',
  userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  amount: '100.00',
  amountIdr: '1625000',
  chain: 'polygon',
  safeType: 'STAFF',
  status: 'PENDING_APPROVAL',
  safeTxHash: null,
  createdBy: 'stf_1',
  createdAt: '2026-05-01T00:00:00Z',
  ...overrides,
})

function ok(rows: RequestListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 20, total: rows.length },
    data: rows,
  })
}

function TestApp() {
  return (
    <Routes>
      <Route path="/burn" element={<BurnListPage />} />
      <Route
        path="/burn/new"
        element={<div data-testid="burn-form-landing">Burn form landing</div>}
      />
    </Routes>
  )
}

function setup(opts?: { staffId?: string }) {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/burn'],
    authenticated: true,
    staffId: opts?.staffId,
  })
}

describe('BurnListPage @ USDX-52', () => {
  describe('positive', () => {
    test('AC #1 — opens /burn and renders a row from GET /api/v1/requests?type=burn', async () => {
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          const url = new URL(request.url)
          expect(url.searchParams.get('type')).toBe('burn')
          return ok([baseRow({ userName: 'Alice Anderson' })])
        })
      )
      setup()
      await screen.findByText('Alice Anderson')
    })

    test('AC #2 — "Add Burn OTC" button visible top-right for ADMIN operator', async () => {
      server.use(http.get('/api/v1/requests', () => ok([])))
      setup() // default staff is Demo Operator (ADMIN)
      const buttons = await screen.findAllByRole('button', { name: /add burn otc/i })
      expect(buttons.length).toBeGreaterThan(0)
    })

    test('AC #3 — clicking "Add Burn OTC" navigates to /burn/new', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/requests', () => ok([])))
      setup()
      const button = (await screen.findAllByRole('button', { name: /add burn otc/i }))[0]!
      await user.click(button)
      await screen.findByTestId('burn-form-landing')
    })

    test('AC #5 — selecting status PENDING_APPROVAL passes ?status=PENDING_APPROVAL', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          captured.push(new URL(request.url).search)
          return ok([])
        })
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('combobox', { name: /status filter/i }))
      await user.click(await screen.findByRole('option', { name: /pending approval/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('status=PENDING_APPROVAL'))).toBe(true)
      )
    })

    test('search input wires to ?search= (USDX-52 delta vs USDX-50)', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          captured.push(new URL(request.url).search)
          return ok([])
        })
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.type(screen.getByLabelText(/^search$/i), 'alice')

      await waitFor(() =>
        expect(captured.some((s) => s.includes('search=alice'))).toBe(true)
      )
    })

    test('row click opens the request detail modal (modal-based detail view)', async () => {
      const user = userEvent.setup()
      const row = baseRow({ id: 'req_open', userName: 'Modal Target' })
      server.use(
        http.get('/api/v1/requests', () => ok([row])),
        http.get('/api/v1/requests/req_open', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: 'req_open',
              type: 'burn',
              status: 'PENDING_APPROVAL',
              idempotencyKey: '0x' + 'a'.repeat(64),
              userId: row.userId,
              userName: row.userName,
              userAddress: row.userAddress,
              amount: row.amount,
              amountWei: '100000000',
              amountIdr: row.amountIdr,
              rateUsed: '16250',
              chain: row.chain,
              notes: null,
              safeType: row.safeType,
              safeTxHash: null,
              onChainTxHash: null,
              depositTxHash: '0x' + 'b'.repeat(64),
              bankName: 'Bank Central Asia',
              bankAccount: '1234567890',
              createdBy: row.createdBy,
              createdAt: row.createdAt,
              updatedAt: row.createdAt,
            },
          })
        )
      )
      setup()
      const cell = await screen.findByText('Modal Target')
      await user.click(cell)
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/burn request/i)).toBeInTheDocument()
    })
  })

  describe('USDX-35 AC6 — input currency badge in Amount column', () => {
    test('USD-input row shows badge attached to the USDX line', async () => {
      server.use(
        http.get('/api/v1/requests', () =>
          ok([baseRow({ id: 'req_usd', userName: 'USD Row', inputCurrency: 'USD' })])
        )
      )
      setup()
      await screen.findByText('USD Row')
      const badges = screen.getAllByTestId('input-currency-badge')
      expect(badges).toHaveLength(1)
      expect(badges[0]).toHaveAttribute('data-currency', 'USD')
    })

    test('IDR-input row shows badge attached to the IDR line', async () => {
      server.use(
        http.get('/api/v1/requests', () =>
          ok([baseRow({ id: 'req_idr', userName: 'IDR Row', inputCurrency: 'IDR' })])
        )
      )
      setup()
      await screen.findByText('IDR Row')
      const badges = screen.getAllByTestId('input-currency-badge')
      expect(badges).toHaveLength(1)
      expect(badges[0]).toHaveAttribute('data-currency', 'IDR')
    })

    test('row without inputCurrency renders no badge (graceful degrade if BE omits)', async () => {
      server.use(http.get('/api/v1/requests', () => ok([baseRow({})])))
      setup()
      await screen.findByText('Alice Anderson')
      expect(screen.queryByTestId('input-currency-badge')).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('DEVELOPER role does not see "Add Burn OTC" header button', async () => {
      server.use(http.get('/api/v1/requests', () => ok([baseRow({})])))
      // stf_3 = Marcus Aurelius (DEVELOPER). The seed factory in
      // src/mocks/data.ts uses post-increment on staffIdCounter, which offsets
      // STAFF_NAMES by one — so DEVELOPER lands at stf_3, not stf_4.
      setup({ staffId: 'stf_3' })
      await screen.findByText('Alice Anderson')
      expect(
        screen.queryByRole('button', { name: /add burn otc/i })
      ).not.toBeInTheDocument()
    })

    test('empty state CTA is hidden for DEVELOPER (no rows + no submit privilege)', async () => {
      server.use(http.get('/api/v1/requests', () => ok([])))
      setup({ staffId: 'stf_3' })
      await screen.findByText(/no burn requests yet/i)
      expect(
        screen.queryByRole('button', { name: /add burn otc/i })
      ).not.toBeInTheDocument()
    })
  })
})
