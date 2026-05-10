import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest'
import { Route, Routes } from 'react-router'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import NotificationBell from '@/components/layout/NotificationBell'
import { renderWithProviders } from '@/test/test-utils'
import type { RequestListItem } from '@/lib/types'

// USDX-38 — bell sits in the navbar, opens a popover of pending approvals,
// and clicking a row deep-links to the Safe UI.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

const STAFF_SAFE = '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015'

function stubSafeEnv() {
  vi.stubEnv('VITE_SAFE_CHAIN_ID', '137')
  vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', STAFF_SAFE)
  vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', STAFF_SAFE)
}

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
  safeTxHash: '0x' + 'a'.repeat(64),
  createdBy: 'stf_1',
  createdAt: '2026-05-09T00:00:00Z',
  ...overrides,
})

function ok(rows: RequestListItem[], total = rows.length) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: rows.length || 1, total },
    data: rows,
  })
}

function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<NotificationBell />} />
      <Route
        path="/notifications"
        element={<div data-testid="notifications-landing">Notifications landing</div>}
      />
    </Routes>,
    { initialEntries: ['/'], authenticated: true }
  )
}

describe('NotificationBell @ USDX-38', () => {
  describe('positive', () => {
    test('should render badge with pending count from metadata.total', async () => {
      stubSafeEnv()
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          const url = new URL(request.url)
          const limit = Number(url.searchParams.get('limit') ?? '8')
          // Total stays at 5 regardless of which limit the bell asks for.
          const rows = Array.from({ length: Math.min(5, limit) }).map((_, i) =>
            baseRow({ id: `req_${i + 1}` })
          )
          return ok(rows, 5)
        })
      )
      setup()
      const badge = await screen.findByTestId('notification-bell-badge')
      expect(badge.textContent).toBe('5')
    })

    test('should hide badge when count is 0', async () => {
      stubSafeEnv()
      server.use(http.get('/api/v1/requests', () => ok([], 0)))
      setup()
      // Wait for the trigger to be present, then assert no badge.
      await screen.findByTestId('notification-bell')
      expect(screen.queryByTestId('notification-bell-badge')).toBeNull()
    })

    test('should open popover and show top rows on click', async () => {
      stubSafeEnv()
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/requests', () =>
          ok([
            baseRow({ id: 'req_1', userName: 'Alice Anderson' }),
            baseRow({ id: 'req_2', userName: 'Bob Santoso', type: 'burn' }),
          ])
        )
      )
      setup()
      await screen.findByTestId('notification-bell-badge')
      await user.click(screen.getByTestId('notification-bell'))
      await screen.findByText('Alice Anderson')
      await screen.findByText('Bob Santoso')
    })

    test('should open Safe UI in a new tab when a row is clicked', async () => {
      stubSafeEnv()
      const user = userEvent.setup()
      const safeTxHash = '0x' + 'c'.repeat(64)
      const openSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null as unknown as Window)
      server.use(
        http.get('/api/v1/requests', () =>
          ok([baseRow({ id: 'req_1', safeTxHash })])
        )
      )
      setup()
      await screen.findByTestId('notification-bell-badge')
      await user.click(screen.getByTestId('notification-bell'))
      await user.click(await screen.findByTestId('notification-row-req_1'))

      expect(openSpy).toHaveBeenCalledTimes(1)
      const [url, target] = openSpy.mock.calls[0]!
      expect(url).toContain('app.safe.global')
      expect(url).toContain(`safe=matic%3A${STAFF_SAFE}`)
      expect(url).toContain(`id=multisig_${STAFF_SAFE}_${safeTxHash}`)
      expect(target).toBe('_blank')
    })
  })

  describe('edge cases', () => {
    test('should show empty state in popover when there are 0 pending', async () => {
      stubSafeEnv()
      const user = userEvent.setup()
      server.use(http.get('/api/v1/requests', () => ok([], 0)))
      setup()
      await screen.findByTestId('notification-bell')
      await user.click(screen.getByTestId('notification-bell'))
      await screen.findByText(/no pending approvals/i)
    })
  })
})
