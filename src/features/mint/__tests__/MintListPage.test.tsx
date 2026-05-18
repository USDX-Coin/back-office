import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import MintListPage from '@/features/mint/MintListPage'
import { renderWithProviders } from '@/test/test-utils'
import type { RequestListItem } from '@/lib/types'

// USDX-51 — Mint list page (separated from form). Covers AC #1, #2, #3, #5,
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
  type: 'mint',
  userId: 'usr_1',
  userName: 'Alice Anderson',
  userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  amount: '100.00',
  amountIdr: '1625000',
  chain: 'polygon',
  safeType: 'STAFF',
  status: 'PENDING_APPROVAL',
  safeTxHash: null,
  onChainTxHash: null,
  createdBy: 'stf_1',
  createdByName: 'Sam Operator',
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
      <Route path="/mint" element={<MintListPage />} />
      {/* USDX-78: deep-link route renders the same page so the modal opens
          from URL state (useParams) instead of React state. */}
      <Route path="/mint/:id" element={<MintListPage />} />
      <Route
        path="/mint/new"
        element={<div data-testid="mint-form-landing">Mint form landing</div>}
      />
    </Routes>
  )
}

function setup(opts?: { staffId?: string }) {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/mint'],
    authenticated: true,
    staffId: opts?.staffId,
  })
}

describe('MintListPage @ USDX-51', () => {
  describe('positive', () => {
    test('AC #1 — opens /mint and renders a row from GET /api/v1/requests?type=mint', async () => {
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          const url = new URL(request.url)
          expect(url.searchParams.get('type')).toBe('mint')
          return ok([baseRow({ userName: 'Alice Anderson' })])
        })
      )
      setup()
      await screen.findByText('Alice Anderson')
    })

    test('USDX-71 — "On-chain tx" + "Safe tx" columns render clickable short hashes only when present', async () => {
      const onChainTx = '0x' + 'a'.repeat(64)
      server.use(
        http.get('/api/v1/requests', () =>
          ok([
            baseRow({
              id: 'with_links',
              userName: 'Has Links',
              chain: 'polygon',
              safeType: 'STAFF',
              status: 'EXECUTED',
              safeTxHash: '0x' + 'b'.repeat(64),
              onChainTxHash: onChainTx,
            }),
            baseRow({ id: 'no_links', userName: 'No Links', safeTxHash: null, onChainTxHash: null }),
          ])
        )
      )
      setup()
      await screen.findByText('Has Links')
      await screen.findByText('No Links')
      // two dedicated columns
      expect(screen.getByRole('columnheader', { name: /on-chain tx/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /safe tx/i })).toBeInTheDocument()
      await waitFor(() => {
        expect(
          document.querySelector(`a[href="https://polygonscan.com/tx/${onChainTx}"]`)
        ).not.toBeNull()
      })
      // exactly one explorer-tx link (the "Has Links" row) and one Safe link
      expect(document.querySelectorAll('a[href^="https://polygonscan.com/tx/"]').length).toBe(1)
      expect(
        document.querySelectorAll('a[href^="https://app.safe.global/transactions/tx"]').length
      ).toBe(1)
      const link = document.querySelector(`a[href="https://polygonscan.com/tx/${onChainTx}"]`)!
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      // cell shows a truncated hash, not the full string
      expect(link.textContent).toContain('0xaaaaaaaa')
      expect(link.textContent).not.toContain(onChainTx)
    })

    test('AC #2 — "Add Mint OTC" button visible top-right for ADMIN operator', async () => {
      server.use(http.get('/api/v1/requests', () => ok([])))
      setup() // default staff is Demo Operator (ADMIN)
      const buttons = await screen.findAllByRole('button', { name: /add mint otc/i })
      expect(buttons.length).toBeGreaterThan(0)
    })

    test('AC #3 — clicking "Add Mint OTC" navigates to /mint/new', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/requests', () => ok([])))
      setup()
      // Header button is rendered first; the empty-state CTA also exists.
      // Both should navigate the same way; click the first.
      const button = (await screen.findAllByRole('button', { name: /add mint otc/i }))[0]!
      await user.click(button)
      await screen.findByTestId('mint-form-landing')
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

      // USDX-27: filters now live behind a "Filter" popover (TableToolbar).
      // Open it → pick Status → Apply → URL param wires through.
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Status' }))
      await user.click(await screen.findByRole('option', { name: /pending approval/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('status=PENDING_APPROVAL'))).toBe(true)
      )
    })

    test('USDX-98 — date range filter wires to ?startDate=&endDate=', async () => {
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

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      // <input type="date"> — fireEvent.change is the reliable jsdom path.
      fireEvent.change(await screen.findByLabelText('Date range start'), {
        target: { value: '2026-05-01' },
      })
      fireEvent.change(screen.getByLabelText('Date range end'), {
        target: { value: '2026-05-12' },
      })
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(
          captured.some(
            (s) => s.includes('startDate=2026-05-01') && s.includes('endDate=2026-05-12')
          )
        ).toBe(true)
      )
    })

    test('USDX-98 — clearing the date range removes startDate/endDate from the query', async () => {
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

      // Apply a range first…
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      fireEvent.change(await screen.findByLabelText('Date range start'), {
        target: { value: '2026-05-01' },
      })
      fireEvent.change(screen.getByLabelText('Date range end'), {
        target: { value: '2026-05-12' },
      })
      await user.click(screen.getByRole('button', { name: /^apply$/i }))
      await waitFor(() =>
        expect(captured.some((s) => s.includes('startDate=2026-05-01'))).toBe(true)
      )

      // …then clear both and re-apply → params drop out of the URL.
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      fireEvent.change(await screen.findByLabelText('Date range start'), {
        target: { value: '' },
      })
      fireEvent.change(screen.getByLabelText('Date range end'), {
        target: { value: '' },
      })
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() => {
        const last = captured[captured.length - 1]
        expect(last.includes('startDate')).toBe(false)
        expect(last.includes('endDate')).toBe(false)
      })
    })

    test('search input wires to ?search= (USDX-51 delta vs USDX-50)', async () => {
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
              type: 'mint',
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
      expect(within(dialog).getByText(/mint request/i)).toBeInTheDocument()
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
    test('DEVELOPER role does not see "Add Mint OTC" header button', async () => {
      server.use(http.get('/api/v1/requests', () => ok([baseRow({})])))
      // stf_3 = Marcus Aurelius (DEVELOPER). The seed factory in
      // src/mocks/data.ts uses post-increment on staffIdCounter, which offsets
      // STAFF_NAMES by one — so DEVELOPER lands at stf_3, not stf_4.
      setup({ staffId: 'stf_3' })
      await screen.findByText('Alice Anderson')
      expect(
        screen.queryByRole('button', { name: /add mint otc/i })
      ).not.toBeInTheDocument()
    })

    test('empty state CTA is hidden for DEVELOPER (no rows + no submit privilege)', async () => {
      server.use(http.get('/api/v1/requests', () => ok([])))
      setup({ staffId: 'stf_3' })
      await screen.findByText(/no mint requests yet/i)
      expect(
        screen.queryByRole('button', { name: /add mint otc/i })
      ).not.toBeInTheDocument()
    })
  })

  // USDX-78 — list rework: ID column (truncated + copy), Created By column,
  // search by ID, URL-driven detail modal (/mint/:id deep-link).
  describe('USDX-78 — list rework', () => {
    test('renders ID column with truncated `prefix…suffix` (8 + 6)', async () => {
      // 36-char UUID — head 8 + tail 6 per sot/phase-1.md L671.
      const fullId = '019e1aa8-1111-2222-3333-444555c7fcd6'
      server.use(http.get('/api/v1/requests', () => ok([baseRow({ id: fullId })])))
      setup()
      await screen.findByText('Alice Anderson')
      // 8 prefix + ellipsis + 6 suffix
      expect(screen.getByText('019e1aa8…c7fcd6')).toBeInTheDocument()
    })

    test('renders Created By column with createdByName from the API', async () => {
      server.use(
        http.get('/api/v1/requests', () =>
          ok([baseRow({ createdByName: 'Jane Operator' })])
        )
      )
      setup()
      await screen.findByText('Jane Operator')
    })

    test('passes the typed search input to /api/v1/requests as `search` (covers ID match)', async () => {
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
      await user.type(screen.getByLabelText(/^search$/i), '019e1aa8')
      await waitFor(() =>
        expect(captured.some((s) => s.includes('search=019e1aa8'))).toBe(true)
      )
    })

    test('row click navigates to /mint/:id and opens the detail modal', async () => {
      const user = userEvent.setup()
      const row = baseRow({ id: 'req_open_78', userName: 'Deep Link' })
      server.use(
        http.get('/api/v1/requests', () => ok([row])),
        http.get('/api/v1/requests/req_open_78', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: row.id,
              type: 'mint',
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
              createdBy: row.createdBy,
              createdByName: 'Detail Owner',
              createdAt: row.createdAt,
              updatedAt: row.createdAt,
            },
          })
        )
      )
      setup()
      await user.click(await screen.findByText('Deep Link'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/mint request/i)).toBeInTheDocument()
      // Created By field also visible in the modal (USDX-78 detail AC).
      expect(within(dialog).getByText('Detail Owner')).toBeInTheDocument()
    })

    test('deep-link entry at /mint/:id auto-opens the modal on first render', async () => {
      const row = baseRow({ id: 'req_deep', userName: 'Refresh Target' })
      server.use(
        http.get('/api/v1/requests', () => ok([row])),
        http.get('/api/v1/requests/req_deep', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: row.id,
              type: 'mint',
              status: 'PENDING_APPROVAL',
              idempotencyKey: '0x' + 'b'.repeat(64),
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
              createdBy: row.createdBy,
              createdByName: 'Refresh Owner',
              createdAt: row.createdAt,
              updatedAt: row.createdAt,
            },
          })
        )
      )
      renderWithProviders(<TestApp />, {
        initialEntries: ['/mint/req_deep'],
        authenticated: true,
      })
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/mint request/i)).toBeInTheDocument()
    })
  })
})
