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
    test('should render header + KPI cards + Volume Trend', () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      expect(
        screen.getByRole('heading', { name: /^dashboard$/i }),
      ).toBeInTheDocument()
      expect(screen.getByText(/mint volume/i)).toBeInTheDocument()
      expect(screen.getByText(/redeem volume/i)).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: /volume trend/i }),
      ).toBeInTheDocument()
    })

    test('should render Network split once data loads', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      await waitFor(
        () => {
          expect(
            screen.getByRole('heading', { name: /network split/i }),
          ).toBeInTheDocument()
        },
        { timeout: 3000 },
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
