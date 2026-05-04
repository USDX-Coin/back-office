import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import StaffPage from '@/features/staff/StaffPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('StaffPage', () => {
  describe('positive', () => {
    test('should render the page header and Add Staff button', () => {
      renderWithProviders(<StaffPage />, { authenticated: true })
      expect(
        screen.getByRole('heading', { name: /staf.*directory/i })
      ).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /add staff/i }).length).toBeGreaterThan(0)
    })

    test('should populate the table from /api/staff', async () => {
      renderWithProviders(<StaffPage />, { authenticated: true })
      await waitFor(() => {
        const avatars = screen.getAllByRole('img')
        expect(avatars.length).toBeGreaterThan(2)
      }, { timeout: 3000 })
    })

    test('should render Total Staff / Admins / Active Now summary cards', () => {
      renderWithProviders(<StaffPage />, { authenticated: true })
      expect(screen.getByText(/total staff/i)).toBeInTheDocument()
      expect(screen.getByText(/^admins$/i)).toBeInTheDocument()
      expect(screen.getByText(/active now/i)).toBeInTheDocument()
    })
  })

  describe('filter toolbar', () => {
    test('should render search input and role select', () => {
      renderWithProviders(<StaffPage />, { authenticated: true })
      expect(screen.getByLabelText(/search staff/i)).toBeInTheDocument()
      // Radix Select renders the placeholder span AND the SelectItem with the same text;
      // assert presence via length.
      expect(screen.getAllByText(/all roles/i).length).toBeGreaterThan(0)
    })
  })
})
