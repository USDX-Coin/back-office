import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import DashboardPage from '@/features/dashboard/DashboardPage'
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
      expect(screen.getByRole('heading', { name: /operations overview/i })).toBeInTheDocument()
      expect(screen.getByText(/total mint volume/i)).toBeInTheDocument()
      expect(screen.getByText(/total redeem volume/i)).toBeInTheDocument()
      expect(screen.getByText(/active users/i)).toBeInTheDocument()
      expect(screen.getByText(/pending transactions/i)).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /volume trend/i })).toBeInTheDocument()
    })

    test('should render Network Distribution once data loads', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      await waitFor(
        () => {
          expect(screen.getByRole('heading', { name: /network distribution/i })).toBeInTheDocument()
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
