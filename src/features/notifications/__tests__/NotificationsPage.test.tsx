import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData, flushApproval } from '@/mocks/handlers'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

async function getList(): Promise<HTMLElement> {
  return await waitFor(
    () => screen.getByTestId('notifications-list'),
    { timeout: 3000 }
  )
}

describe('NotificationsPage', () => {
  describe('AC #1 — open /notifications shows pending requests', () => {
    test('should render the page header', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      expect(screen.getByRole('heading', { name: /notifications/i })).toBeInTheDocument()
    })

    test('should render a list of pending Safe approvals', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const items = within(list).getAllByRole('listitem')
      expect(items.length).toBeGreaterThan(0)
    })

    test('should show type, userName, amount, safeType and createdAt per item', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const firstItem = within(list).getAllByRole('listitem')[0]!
      // type label (mint or redeem) appears as visible text
      expect(within(firstItem).getByText(/mint|redeem/i)).toBeInTheDocument()
      // amount in USDX
      expect(within(firstItem).getByText(/\d[\d,]*\s+USDX/)).toBeInTheDocument()
      // userName placeholder
      expect(within(firstItem).getByTestId('user-name').textContent?.length).toBeGreaterThan(0)
      // safeType badge
      expect(within(firstItem).getByTestId('safe-type-badge').textContent).toMatch(
        /staff safe|manager safe/i
      )
      // relative createdAt
      expect(within(firstItem).getByTestId('created-at').textContent?.length).toBeGreaterThan(0)
    })
  })

  describe('AC #2 — Open in Safe link', () => {
    test('should render an "Open in Safe" anchor that opens a new tab', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const links = within(list).getAllByRole('link', { name: /open .* in safe/i })
      expect(links.length).toBeGreaterThan(0)
      const link = links[0]! as HTMLAnchorElement
      expect(link.target).toBe('_blank')
      expect(link.rel).toContain('noopener')
      expect(link.rel).toContain('noreferrer')
    })

    test('should generate a Safe app URL from safeAddress + safeTxHash + chain', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const link = within(list).getAllByRole('link', { name: /open .* in safe/i })[0]! as HTMLAnchorElement
      const url = new URL(link.href)
      expect(url.host).toBe('app.safe.global')
      expect(url.pathname).toBe('/transactions/tx')
      const safe = url.searchParams.get('safe') ?? ''
      expect(safe).toMatch(/^(matic|pol|eth|base|arb1):0x[0-9a-fA-F]+$/)
      const id = url.searchParams.get('id') ?? ''
      expect(id).toMatch(/^multisig_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+$/)
    })
  })

  describe('AC #4 — executed item disappears from list', () => {
    test('should drop an item once its status transitions out of pending_approval', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const before = within(list).getAllByRole('listitem')
      const initialCount = before.length
      expect(initialCount).toBeGreaterThan(0)

      // Identify the first item's user name so we can assert it disappears
      const firstUserName = within(before[0]!).getByTestId('user-name').textContent
      expect(firstUserName).toBeTruthy()

      // Simulate Safe UI sign+execute on the first pending row.
      // We fetch the API to discover the id since the rendered list does not
      // expose it directly.
      const apiList = await (await fetch('/api/notifications')).json()
      flushApproval(apiList.data[0].id, 'completed')

      await waitFor(
        async () => {
          const stillThere = screen.queryByText(firstUserName!)
          // After polling refetch, the prior first-row user should no longer
          // be visible (or the list should have one fewer row).
          if (stillThere) {
            const items = within(screen.getByTestId('notifications-list')).getAllByRole('listitem')
            expect(items.length).toBeLessThan(initialCount)
          } else {
            expect(stillThere).toBeNull()
          }
        },
        { timeout: 8000 }
      )
    }, 10_000)
  })

  describe('empty state', () => {
    test('should render a friendly empty state when no pending approvals exist', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      // Drain every pending_approval row via the test hook before the page
      // settles; subsequent polling refetches will pick up the empty state.
      const apiList = await (await fetch('/api/notifications')).json()
      for (const n of apiList.data) flushApproval(n.id, 'completed')

      await waitFor(
        () => {
          expect(screen.getByText(/all clear/i)).toBeInTheDocument()
        },
        { timeout: 8000 }
      )
    }, 10_000)
  })
})
