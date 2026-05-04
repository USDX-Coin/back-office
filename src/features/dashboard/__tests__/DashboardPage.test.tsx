import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import DashboardPage from '@/features/dashboard/DashboardPage'
import { DASHBOARD_STATS_POLL_MS } from '@/features/dashboard/hooks'
import { renderWithProviders } from '@/test/test-utils'

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

// USDX-16 — acceptance criteria
//
// • Open /dashboard → all stats displayed
// • Numbers match API response
// • Click "pending requests" → navigate to filtered request list
// • Auto-refresh (polling every 30 seconds or configurable)
describe('DashboardPage USDX-16 (real-data stats)', () => {
  describe('acceptance: all stats displayed', () => {
    test('renders the SoT phase-1 stats card grid', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      // Wait for the data-loaded sections; safe-balance-staff renders only
      // once `useDashboardStats` resolves, so it doubles as a loading gate.
      await waitFor(
        () => expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument(),
        { timeout: 3000 }
      )
      expect(screen.getByTestId('dashboard-phase1-stats')).toBeInTheDocument()
      expect(screen.getByTestId('stat-total-supply')).toBeInTheDocument()
      expect(screen.getByTestId('stat-total-minted')).toBeInTheDocument()
      expect(screen.getByTestId('stat-total-burned')).toBeInTheDocument()
      expect(screen.getByTestId('stat-pending-requests')).toBeInTheDocument()
      expect(screen.getByTestId('stat-requests-by-status')).toBeInTheDocument()
      expect(screen.getByTestId('stat-safe-balances')).toBeInTheDocument()
      expect(screen.getByTestId('stat-current-rate')).toBeInTheDocument()
      expect(screen.getByTestId('safe-balance-manager')).toBeInTheDocument()
    })

    test('renders one row per request status (PENDING_APPROVAL/APPROVED/EXECUTED/REJECTED)', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByTestId('requests-status-PENDING_APPROVAL')).toBeInTheDocument()
      })
      expect(screen.getByTestId('requests-status-APPROVED')).toBeInTheDocument()
      expect(screen.getByTestId('requests-status-EXECUTED')).toBeInTheDocument()
      expect(screen.getByTestId('requests-status-REJECTED')).toBeInTheDocument()
    })
  })

  describe('acceptance: numbers match API response', () => {
    test('pending count matches /api/v1/dashboard/stats payload', async () => {
      const apiStats = (
        await (await fetch('/api/v1/dashboard/stats')).json()
      ).data as {
        pendingRequests: number
        requestsByStatus: Record<string, number>
        safeBalances: { staff: string; manager: string }
      }

      renderWithProviders(<DashboardPage />, { authenticated: true })

      // Pending count card uses tabular-nums; locate via testid then check text.
      await waitFor(() => {
        const card = screen.getByTestId('stat-pending-requests')
        expect(
          within(card).getByText(apiStats.pendingRequests.toLocaleString())
        ).toBeInTheDocument()
      })

      // Per-status counts inside the breakdown card.
      const statusCard = screen.getByTestId('stat-requests-by-status')
      for (const [status, count] of Object.entries(apiStats.requestsByStatus)) {
        const row = within(statusCard).getByTestId(`requests-status-${status}`)
        expect(within(row).getByText(count.toLocaleString())).toBeInTheDocument()
      }
    })
  })

  describe('acceptance: pending requests link', () => {
    test('pending card links to /requests filtered by PENDING_APPROVAL', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      const link = await screen.findByLabelText(/view pending requests/i)
      expect(link).toHaveAttribute('href', '/requests?status=PENDING_APPROVAL')
    })
  })

  describe('acceptance: auto-refresh interval', () => {
    test('useDashboardStats polls every 30s (configurable constant)', () => {
      expect(DASHBOARD_STATS_POLL_MS).toBe(30_000)
    })
  })
})
