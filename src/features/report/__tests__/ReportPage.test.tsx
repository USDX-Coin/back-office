import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import ReportPage from '@/features/report/ReportPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('ReportPage', () => {
  describe('positive', () => {
    test('should render header + filter toolbar + Export CSV', () => {
      renderWithProviders(<ReportPage />, { authenticated: true })
      expect(
        screen.getByRole('heading', { name: /^report$/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /export csv/i }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
    })

    test('should render status segmented group with role=group', () => {
      renderWithProviders(<ReportPage />, { authenticated: true })
      expect(screen.getByRole('group', { name: /status filter/i })).toBeInTheDocument()
    })

    test('should populate table rows from /api/report', async () => {
      renderWithProviders(<ReportPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getAllByRole('img').length).toBeGreaterThan(1)
      }, { timeout: 3000 })
    })

    // ReportInsightsBento was removed in the page-header simplification
    // (commit b359284). The page now renders title + table directly.
  })

  describe('regression guards', () => {
    test('should NOT render Export PDF (v1 scope exclusion)', () => {
      renderWithProviders(<ReportPage />, { authenticated: true })
      expect(screen.queryByRole('button', { name: /export pdf/i })).not.toBeInTheDocument()
    })
  })
})
