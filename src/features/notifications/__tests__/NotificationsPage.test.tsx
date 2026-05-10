import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import { renderWithProviders } from '@/test/test-utils'
import type { RequestListItem } from '@/lib/types'

// USDX-38 — Notifications page: list pending Safe approvals + per-row
// "Open in Safe" deep-link.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  vi.unstubAllEnvs()
})
afterAll(() => server.close())

const STAFF_SAFE = '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015'
const MGR_SAFE = '0xbB4f81408EeB7787B98B36D2c4d1f01F352fC026'

function stubSafeEnv() {
  vi.stubEnv('VITE_SAFE_CHAIN_ID', '137')
  vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', STAFF_SAFE)
  vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', MGR_SAFE)
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

function ok(rows: RequestListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 20, total: rows.length },
    data: rows,
  })
}

function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/notifications" element={<NotificationsPage />} />
    </Routes>,
    { initialEntries: ['/notifications'], authenticated: true }
  )
}

describe('NotificationsPage @ USDX-38', () => {
  describe('positive', () => {
    test('should fetch only PENDING_APPROVAL rows (no type filter)', async () => {
      stubSafeEnv()
      let observedStatus: string | null = null
      let observedType: string | null = null
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          const url = new URL(request.url)
          observedStatus = url.searchParams.get('status')
          observedType = url.searchParams.get('type')
          return ok([baseRow({})])
        })
      )
      setup()
      await screen.findByText('Alice Anderson')
      expect(observedStatus).toBe('PENDING_APPROVAL')
      expect(observedType).toBeNull()
    })

    test('should render an Open-in-Safe link with the correct deep-link URL', async () => {
      stubSafeEnv()
      const safeTxHash = '0x' + 'b'.repeat(64)
      server.use(
        http.get('/api/v1/requests', () =>
          ok([baseRow({ id: 'req_2', safeTxHash, safeType: 'MANAGER' })])
        )
      )
      setup()
      const link = await screen.findByTestId('open-in-safe-req_2')
      const href = link.getAttribute('href')!
      expect(href).toContain('app.safe.global')
      expect(href).toContain(`safe=matic%3A${MGR_SAFE}`)
      expect(href).toContain(`id=multisig_${MGR_SAFE}_${safeTxHash}`)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    })

    test('should fall back to "No tx hash yet" when safeTxHash is null', async () => {
      stubSafeEnv()
      server.use(
        http.get('/api/v1/requests', () =>
          ok([baseRow({ id: 'req_3', safeTxHash: null })])
        )
      )
      setup()
      await screen.findByText('No tx hash yet')
    })
  })

  describe('negative', () => {
    test('should hide the link when env is misconfigured', async () => {
      // No env stubs → resolveSafeAddress throws → URL falls back to null →
      // we render the "No tx hash yet" placeholder rather than a broken link.
      vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', '')
      vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', '')
      server.use(http.get('/api/v1/requests', () => ok([baseRow({})])))
      setup()
      await screen.findByText('Alice Anderson')
      expect(screen.queryByTestId('open-in-safe-req_1')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should show empty state when no pending approvals', async () => {
      stubSafeEnv()
      server.use(http.get('/api/v1/requests', () => ok([])))
      setup()
      await screen.findByText(/no pending approvals/i)
    })
  })
})
