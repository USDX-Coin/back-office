import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import RequestsPage from '@/features/requests/RequestsPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

async function waitForClickableRows(container: HTMLElement) {
  return waitFor(
    () => {
      const rows = container.querySelectorAll(
        'tr[role="button"][aria-label^="Open"]'
      )
      if (rows.length === 0) {
        throw new Error('clickable rows not yet rendered')
      }
      return rows
    },
    { timeout: 3000 }
  )
}

function getTypeCells(container: HTMLElement): string[] {
  // The "Type" cell is the second column (after Date). Each clickable row has
  // a span with text "Mint" or "Burn".
  const cells = Array.from(
    container.querySelectorAll('tr[role="button"] td:nth-child(2)')
  )
  return cells.map((c) => (c.textContent || '').trim())
}

function getStatusCells(container: HTMLElement): string[] {
  // Status is the last data column. Read the visible label inside the pill.
  const cells = Array.from(
    container.querySelectorAll('tr[role="button"] td:last-child')
  )
  return cells.map((c) => (c.textContent || '').trim())
}

describe('RequestsPage @ USDX-8 acceptance', () => {
  // ─── AC1: Open /requests → table appears ───
  describe('AC1 — open /requests', () => {
    test('should render the page title and a populated table', async () => {
      const { container } = renderWithProviders(<RequestsPage />, {
        authenticated: true,
      })

      // Page header — PageHeader composes title + italic accent
      expect(
        screen.getByRole('heading', { name: /requests.*mint.*burn/i })
      ).toBeInTheDocument()

      // Table is populated with at least one clickable row from the API
      await waitForClickableRows(container)
    })
  })

  // ─── AC2: Filter by type=mint → only mint shown ───
  describe('AC2 — filter by type=mint', () => {
    test('should restrict the table to mint rows only', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProviders(<RequestsPage />, {
        authenticated: true,
      })
      await waitForClickableRows(container)

      const typeGroup = screen.getByRole('group', { name: /type filter/i })
      await user.click(within(typeGroup).getByRole('button', { name: /^mint$/i }))

      await waitFor(() => {
        const types = getTypeCells(container)
        expect(types.length).toBeGreaterThan(0)
        expect(types.every((t) => /mint/i.test(t))).toBe(true)
        expect(types.some((t) => /burn/i.test(t))).toBe(false)
      })
    })
  })

  // ─── AC3: Filter by status=PENDING_APPROVAL → filtered ───
  describe('AC3 — filter by status=PENDING_APPROVAL', () => {
    test('should restrict the table to pending-approval rows', async () => {
      const { container } = renderWithProviders(<RequestsPage />, {
        authenticated: true,
        initialEntries: ['/requests?status=PENDING_APPROVAL'],
      })
      await waitForClickableRows(container)

      const statuses = getStatusCells(container)
      expect(statuses.length).toBeGreaterThan(0)
      expect(statuses.every((s) => /pending approval/i.test(s))).toBe(true)
    })
  })

  // ─── AC4: Pagination — page 2 → data changes ───
  describe('AC4 — pagination', () => {
    test('should fetch a different row set on page 2', async () => {
      // Capture the row IDs returned for page 1 and page 2 so we can assert
      // they differ. Default mock seeds 64 requests → page 2 is non-empty.
      const { container, unmount } = renderWithProviders(<RequestsPage />, {
        authenticated: true,
        initialEntries: ['/requests?page=1'],
      })
      const page1Rows = await waitForClickableRows(container)
      const page1Ids = Array.from(page1Rows).map(
        (r) => r.getAttribute('aria-label') ?? ''
      )
      expect(page1Ids.length).toBeGreaterThan(0)
      unmount()

      const { container: container2 } = renderWithProviders(<RequestsPage />, {
        authenticated: true,
        initialEntries: ['/requests?page=2'],
      })
      const page2Rows = await waitForClickableRows(container2)
      const page2Ids = Array.from(page2Rows).map(
        (r) => r.getAttribute('aria-label') ?? ''
      )
      expect(page2Ids.length).toBeGreaterThan(0)

      // Page 2 yields a non-overlapping set
      const overlap = page1Ids.filter((id) => page2Ids.includes(id))
      expect(overlap).toHaveLength(0)
    })
  })

  // ─── AC5: Click row → all detail fields shown ───
  describe('AC5 — click row opens detail with all fields', () => {
    test('should display the full mint detail in a dialog', async () => {
      // Pin a specific mint detail so we can assert exact values shown
      server.use(
        http.get('/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 10, total: 1 },
            data: [
              {
                id: 'req-mint-1',
                type: 'mint',
                userId: 'usr-1',
                userName: 'Alice Tester',
                userAddress: '0x1111111111111111111111111111111111111111',
                amount: '1234.56',
                amountIdr: '20061800',
                chain: 'polygon',
                safeType: 'STAFF',
                status: 'PENDING_APPROVAL',
                createdBy: 'stf-1',
                createdAt: '2026-01-15T10:00:00.000Z',
              },
            ],
          })
        ),
        http.get('/api/v1/requests/:id', ({ params }) =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: String(params.id),
              type: 'mint',
              idempotencyKey:
                '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              userId: 'usr-1',
              userName: 'Alice Tester',
              userAddress: '0x1111111111111111111111111111111111111111',
              amount: '1234.56',
              amountWei: '1234560000000000000000',
              amountIdr: '20061800',
              rateUsed: '16250',
              chain: 'polygon',
              notes: 'IDR sent from BCA',
              safeType: 'STAFF',
              status: 'PENDING_APPROVAL',
              safeTxHash: null,
              onChainTxHash: null,
              createdBy: 'stf-1',
              createdAt: '2026-01-15T10:00:00.000Z',
              updatedAt: '2026-01-15T10:00:00.000Z',
            },
          })
        )
      )

      const user = userEvent.setup()
      const { container } = renderWithProviders(<RequestsPage />, {
        authenticated: true,
      })
      const rows = await waitForClickableRows(container)
      await user.click(rows[0] as HTMLElement)

      // Dialog opens with the mint heading
      const dialog = await screen.findByRole('dialog')
      expect(
        within(dialog).getByRole('heading', { name: /mint request/i })
      ).toBeInTheDocument()

      // All required RequestListItem + MintRequest detail fields are visible
      expect(within(dialog).getByText(/user name/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/Alice Tester/)).toBeInTheDocument()

      expect(within(dialog).getByText(/user wallet/i)).toBeInTheDocument()
      // Address is shortened — head + tail still rendered
      expect(within(dialog).getByText(/0x11111111/)).toBeInTheDocument()

      expect(within(dialog).getByText(/amount \(usdx\)/i)).toBeInTheDocument()
      expect(within(dialog).getByText('1234.56')).toBeInTheDocument()

      expect(within(dialog).getByText(/amount \(idr\)/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/Rp\s*20\.061\.800/)).toBeInTheDocument()

      expect(within(dialog).getByText(/rate used/i)).toBeInTheDocument()
      expect(within(dialog).getByText('16250')).toBeInTheDocument()

      expect(within(dialog).getByText(/amount \(wei\)/i)).toBeInTheDocument()
      expect(
        within(dialog).getByText('1234560000000000000000')
      ).toBeInTheDocument()

      expect(within(dialog).getByText(/request id/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/idempotency key/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/safe tx hash/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/on-chain tx hash/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/notes/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/IDR sent from BCA/)).toBeInTheDocument()

      // Status pill shows the human label
      expect(
        within(dialog).getByText(/pending approval/i)
      ).toBeInTheDocument()
      // Chain + safe inline meta
      expect(within(dialog).getByText(/staff safe.*polygon/i)).toBeInTheDocument()
    })

    test('should display burn-specific fields (deposit, bank) when burn', async () => {
      server.use(
        http.get('/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 10, total: 1 },
            data: [
              {
                id: 'req-burn-1',
                type: 'burn',
                userId: 'usr-2',
                userName: 'Bob Burner',
                userAddress: '0x2222222222222222222222222222222222222222',
                amount: '500.00',
                amountIdr: '8125000',
                chain: 'ethereum',
                safeType: 'MANAGER',
                status: 'IDR_TRANSFERRED',
                createdBy: 'stf-1',
                createdAt: '2026-01-10T10:00:00.000Z',
              },
            ],
          })
        ),
        http.get('/api/v1/requests/:id', ({ params }) =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: String(params.id),
              type: 'burn',
              idempotencyKey:
                '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
              userId: 'usr-2',
              userName: 'Bob Burner',
              userAddress: '0x2222222222222222222222222222222222222222',
              amount: '500.00',
              amountWei: '500000000000000000000',
              amountIdr: '8125000',
              rateUsed: '16250',
              chain: 'ethereum',
              depositTxHash:
                '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
              bankName: 'BCA',
              bankAccount: '1234567890',
              notes: null,
              safeType: 'MANAGER',
              status: 'IDR_TRANSFERRED',
              safeTxHash:
                '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed',
              onChainTxHash:
                '0xcafecafecafecafecafecafecafecafecafecafecafecafecafecafecafecafe',
              createdBy: 'stf-1',
              createdAt: '2026-01-10T10:00:00.000Z',
              updatedAt: '2026-01-10T10:00:00.000Z',
            },
          })
        )
      )

      const user = userEvent.setup()
      const { container } = renderWithProviders(<RequestsPage />, {
        authenticated: true,
      })
      const rows = await waitForClickableRows(container)
      await user.click(rows[0] as HTMLElement)

      const dialog = await screen.findByRole('dialog')
      expect(
        within(dialog).getByRole('heading', { name: /burn request/i })
      ).toBeInTheDocument()

      // Burn-specific fields
      expect(within(dialog).getByText(/deposit tx hash/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/^bank$/i)).toBeInTheDocument()
      expect(within(dialog).getByText('BCA')).toBeInTheDocument()
      expect(within(dialog).getByText(/bank account/i)).toBeInTheDocument()
      expect(within(dialog).getByText('1234567890')).toBeInTheDocument()

      // Terminal-state status visible
      expect(within(dialog).getByText(/idr transferred/i)).toBeInTheDocument()
    })
  })

  // ─── AC6: Empty state if no data yet ───
  describe('AC6 — empty state', () => {
    test('should render the no-data empty state when the API returns zero rows', async () => {
      server.use(
        http.get('/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 10, total: 0 },
            data: [],
          })
        )
      )
      renderWithProviders(<RequestsPage />, { authenticated: true })

      await waitFor(() => {
        expect(screen.getByText(/no requests yet/i)).toBeInTheDocument()
      })
      expect(
        screen.getByText(/mint and burn requests appear here/i)
      ).toBeInTheDocument()
    })
  })
})
