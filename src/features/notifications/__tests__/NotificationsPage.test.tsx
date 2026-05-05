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

    test('should render a list of PENDING_APPROVAL Safe approvals', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const items = within(list).getAllByRole('listitem')
      expect(items.length).toBeGreaterThan(0)
    })

    test('should show type, userName, amount, safeType and createdAt per item', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const firstItem = within(list).getAllByRole('listitem')[0]!
      // type label (mint or burn) appears as visible text
      expect(within(firstItem).getByText(/mint|burn/i)).toBeInTheDocument()
      // amount in USDX
      expect(within(firstItem).getByText(/[\d.,]+\s+USDX/)).toBeInTheDocument()
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

    test('should generate a Safe app URL from safeTxHash + chain', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const link = within(list).getAllByRole('link', { name: /open .* in safe/i })[0]! as HTMLAnchorElement
      const url = new URL(link.href)
      expect(url.host).toBe('app.safe.global')
      expect(url.pathname).toBe('/transactions/tx')
      const safe = url.searchParams.get('safe') ?? ''
      expect(safe).toMatch(/^(matic|eth|base|arb1):0x[0-9a-fA-F]+$/)
      const id = url.searchParams.get('id') ?? ''
      expect(id).toMatch(/^multisig_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+$/)
    })
  })

  describe('AC #4 — executed item disappears from list', () => {
    test('should drop an item once its status transitions out of PENDING_APPROVAL', async () => {
      renderWithProviders(<NotificationsPage />, { authenticated: true })
      const list = await getList()
      const before = within(list).getAllByRole('listitem')
      const initialCount = before.length
      expect(initialCount).toBeGreaterThan(0)

      const firstUserName = within(before[0]!).getByTestId('user-name').textContent
      expect(firstUserName).toBeTruthy()

      // Simulate Safe UI sign+execute on the first PENDING_APPROVAL row.
      const apiList = await (
        await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')
      ).json()
      flushApproval(apiList.data[0].id, 'EXECUTED')

      await waitFor(
        async () => {
          const stillThere = screen.queryByText(firstUserName!)
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
      // Drain every PENDING_APPROVAL row via the test hook before the page
      // settles; subsequent polling refetches will pick up the empty state.
      const apiList = await (
        await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')
      ).json()
      for (const r of apiList.data) flushApproval(r.id, 'EXECUTED')

      await waitFor(
        () => {
          expect(screen.getByText(/all clear/i)).toBeInTheDocument()
        },
        { timeout: 8000 }
      )
    }, 10_000)
  })
})
