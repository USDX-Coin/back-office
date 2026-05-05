import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import DashboardPage from '@/features/dashboard/DashboardPage'
import { DASHBOARD_STATS_POLL_MS } from '@/features/dashboard/hooks'
import type { DashboardStats } from '@/lib/types'
import { renderWithProviders } from '@/test/test-utils'

// Strip non-digits from both sides and assert digit subsequence — verifies the
// API value reached the user without coupling the test to display formatting
// (which is an AI-assumption, not a SoT requirement).
function expectDigitsRendered(container: HTMLElement, decimalString: string) {
  const expected = decimalString.replace(/\D/g, '')
  const actual = (container.textContent ?? '').replace(/\D/g, '')
  expect(actual).toContain(expected)
}

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('DashboardPage', () => {
  describe('positive', () => {
    test('should render header + 4 KPI cards + Volume Trend', () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      expect(
        screen.getByRole('heading', { name: /dashboard.*overview/i })
      ).toBeInTheDocument()
      expect(screen.getByText(/mint volume \/ 30d/i)).toBeInTheDocument()
      expect(screen.getByText(/redeem volume \/ 30d/i)).toBeInTheDocument()
      expect(screen.getByText(/active customers/i)).toBeInTheDocument()
      expect(screen.getByText(/pending otc/i)).toBeInTheDocument()
      expect(screen.getByText(/^volume trend$/i)).toBeInTheDocument()
    })

    test('should render Network split once data loads', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      await waitFor(
        () => {
          expect(screen.getByText(/network split/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    test('should populate KPI values from /api/dashboard/snapshot', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      // Wait until the em-dash placeholders are replaced with real values
      await waitFor(() => {
        const emDashes = screen.queryAllByText('—')
        expect(emDashes.length).toBeLessThan(4)
      }, { timeout: 3000 })
    })

    test('should render Recent Activity list once data loads', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /recent activity/i })).toBeInTheDocument()
      })
    })
  })
})

// USDX-16 acceptance criteria — Linear ticket:
//   1. Open /dashboard → all stats displayed
//   2. Numbers match API response
//   3. Click "pending requests" → navigate to filtered request list
//   4. Data refreshes without manual reload
//
// Stats schema reference: sot/openapi.yaml § DashboardStats (7 fields).
describe('USDX-16 acceptance criteria', () => {
  test('AC1: opens /dashboard and displays every SoT DashboardStats field', async () => {
    renderWithProviders(<DashboardPage />, { authenticated: true })

    // safe-balance-staff renders only after useDashboardStats resolves —
    // doubles as the data-loaded gate.
    await waitFor(
      () => expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument(),
      { timeout: 3000 }
    )

    // 7 panels matching openapi.yaml § DashboardStats fields
    expect(screen.getByTestId('stat-total-supply')).toBeInTheDocument()
    expect(screen.getByTestId('stat-total-minted')).toBeInTheDocument()
    expect(screen.getByTestId('stat-total-burned')).toBeInTheDocument()
    expect(screen.getByTestId('stat-pending-requests')).toBeInTheDocument()
    expect(screen.getByTestId('stat-requests-by-status')).toBeInTheDocument()
    expect(screen.getByTestId('stat-safe-balances')).toBeInTheDocument()
    expect(screen.getByTestId('stat-current-rate')).toBeInTheDocument()

    // safeBalances → both Staff + Manager rows
    expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument()
    expect(screen.getByTestId('safe-balance-manager')).toBeInTheDocument()

    // requestsByStatus → all 4 keys per openapi.yaml schema
    expect(screen.getByTestId('requests-status-PENDING_APPROVAL')).toBeInTheDocument()
    expect(screen.getByTestId('requests-status-APPROVED')).toBeInTheDocument()
    expect(screen.getByTestId('requests-status-EXECUTED')).toBeInTheDocument()
    expect(screen.getByTestId('requests-status-REJECTED')).toBeInTheDocument()
  })

  test('AC2: every rendered value matches /api/v1/dashboard/stats payload', async () => {
    const stats = (await (await fetch('/api/v1/dashboard/stats')).json()).data as DashboardStats

    renderWithProviders(<DashboardPage />, { authenticated: true })
    await waitFor(
      () => expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument(),
      { timeout: 3000 }
    )

    // Integer counts
    expect(
      within(screen.getByTestId('stat-pending-requests')).getByText(
        stats.pendingRequests.toLocaleString()
      )
    ).toBeInTheDocument()

    const statusCard = screen.getByTestId('stat-requests-by-status')
    for (const [status, count] of Object.entries(stats.requestsByStatus)) {
      const row = within(statusCard).getByTestId(`requests-status-${status}`)
      expect(within(row).getByText(count.toLocaleString())).toBeInTheDocument()
    }

    // Decimal-string fields — assert digit subsequence reaches the user
    expectDigitsRendered(screen.getByTestId('stat-total-supply'), stats.totalSupply)
    expectDigitsRendered(screen.getByTestId('stat-total-minted'), stats.totalMinted)
    expectDigitsRendered(screen.getByTestId('stat-total-burned'), stats.totalBurned)
    expectDigitsRendered(screen.getByTestId('safe-balance-staff'), stats.safeBalances.staff)
    expectDigitsRendered(screen.getByTestId('safe-balance-manager'), stats.safeBalances.manager)
    expectDigitsRendered(screen.getByTestId('stat-current-rate'), stats.currentRate)
  })

  test('AC3: clicking "pending requests" routes to /requests?status=PENDING_APPROVAL', async () => {
    renderWithProviders(<DashboardPage />, { authenticated: true })
    const link = await screen.findByLabelText(/view pending requests/i)
    expect(link).toHaveAttribute('href', '/requests?status=PENDING_APPROVAL')
  })

  test('AC4: data refreshes without manual reload (polling interval is configurable)', () => {
    // Contract assertion: configurable constant matches Linear ticket scope
    // ("polling every 30 seconds or configurable"). Behavioral assertion lives
    // in the next test.
    expect(DASHBOARD_STATS_POLL_MS).toBe(30_000)
  })

  test('AC4: useDashboardStats refetches /api/v1/dashboard/stats after the configured interval elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    try {
      renderWithProviders(<DashboardPage />, { authenticated: true })

      // Wait for the first fetch of /api/v1/dashboard/stats to land.
      await waitFor(() => {
        const calls = fetchSpy.mock.calls.filter(([url]) =>
          String(url).includes('/api/v1/dashboard/stats')
        )
        expect(calls.length).toBeGreaterThanOrEqual(1)
      })

      const before = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes('/api/v1/dashboard/stats')
      ).length

      // Advance just past the configured polling interval.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DASHBOARD_STATS_POLL_MS + 500)
      })

      await waitFor(() => {
        const after = fetchSpy.mock.calls.filter(([url]) =>
          String(url).includes('/api/v1/dashboard/stats')
        ).length
        expect(after).toBeGreaterThan(before)
      })
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})
