import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => localStorage.clear())

describe('Sidebar', () => {
  describe('positive', () => {
    test('should render the top-level workspace, OTC, and insights items', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^user$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^staf$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^mint$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^redeem$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^report$/i })).toBeInTheDocument()
    })

    test('should render Requests entry pointing to /requests (USDX-39)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      const link = screen.getByRole('link', { name: /^requests$/i })
      expect(link).toHaveAttribute('href', '/requests')
    })
  })

  describe('AC #3: role from /auth/me rendered in sidebar footer', () => {
    test('should render staff name and SoT-enum role title-cased', async () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      await waitFor(() => {
        expect(screen.getByText(/Demo Operator/)).toBeInTheDocument()
      })
      const role = screen.getByTestId('staff-role')
      expect(role).toHaveTextContent(/^Admin$/)
    })
  })

  describe('regression guards', () => {
    test('should NOT render Profile as a sidebar item (R8)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(
        screen.queryByRole('link', { name: /^profile$/i }),
      ).not.toBeInTheDocument()
    })
  })
})
