import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import UsersPage from '@/features/users/UsersPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('UsersPage', () => {
  describe('positive', () => {
    test('should render the page title and Add User button', async () => {
      renderWithProviders(<UsersPage />, { authenticated: true })
      expect(
        screen.getByRole('heading', { name: /user client/i }),
      ).toBeInTheDocument()
      expect(
        screen.getAllByRole('button', { name: /add user/i }).length,
      ).toBeGreaterThan(0)
    })

    test('should populate the table from /api/customers', async () => {
      renderWithProviders(<UsersPage />, { authenticated: true })
      // Wait for first data row to render
      await waitFor(
        () => {
          // Avatar role=img with the customer's name as aria-label appears in table rows
          const rows = screen.getAllByRole('img')
          // Multiple avatars (one per row) — table has data
          expect(rows.length).toBeGreaterThan(2)
        },
        { timeout: 3000 }
      )
    })

    // Summary KPI cards were removed in the page-header simplification
    // (commit b359284). The page now renders title + table directly.
  })

  describe('filter toolbar', () => {
    test('should render search input and type/role selects', () => {
      renderWithProviders(<UsersPage />, { authenticated: true })
      expect(screen.getByLabelText(/search users/i)).toBeInTheDocument()
      expect(screen.getByText(/all types/i)).toBeInTheDocument()
      expect(screen.getByText(/all roles/i)).toBeInTheDocument()
    })
  })
})
