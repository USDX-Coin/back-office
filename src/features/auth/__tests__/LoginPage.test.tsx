import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import LoginPage from '@/features/auth/LoginPage'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { TEST_VALID_PASSWORD } from '@/mocks/handlers'

describe('LoginPage', () => {
  describe('positive', () => {
    test('should render the Sign in heading and required fields', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    })

    test('should toggle password visibility', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement
      expect(passwordInput.type).toBe('password')
      fireEvent.click(screen.getByRole('button', { name: /show password/i }))
      expect(passwordInput.type).toBe('text')
    })

    test('should keep Remember-this-device toggle state', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      const checkbox = screen.getByRole('checkbox', { name: /remember this device/i })
      expect(checkbox).toHaveAttribute('data-state', 'checked')
      fireEvent.click(checkbox)
      expect(checkbox).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('negative', () => {
    test('should show inline errors for empty submit', async () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument()
        expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('regression guards', () => {
    test('should NOT render a Forgot password link (R17)', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument()
    })

    test('should NOT render a Register link (R17)', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument()
    })
  })

  describe('USDX-39 integration', () => {
    function DashboardStub() {
      return <div data-testid="dashboard-stub">Dashboard Mock</div>
    }
    function AppShell() {
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardStub />} />
        </Routes>
      )
    }

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())
    beforeEach(() => localStorage.clear())

    describe('AC #1: real credentials → /dashboard', () => {
      test('should redirect to /dashboard on successful login', async () => {
        const user = userEvent.setup()
        renderWithProviders(<AppShell />, { initialEntries: ['/login'] })
        await user.type(screen.getByLabelText(/^email$/i), 'demo@usdx.io')
        await user.type(screen.getByLabelText(/^password$/i), TEST_VALID_PASSWORD)
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))
        await waitFor(() =>
          expect(screen.getByTestId('dashboard-stub')).toBeInTheDocument(),
        )
        expect(localStorage.getItem('usdx_auth_token')).toBeTruthy()
      })
    })

    describe('AC #2: wrong credentials → error message', () => {
      test('should render BE error message in alert region', async () => {
        const user = userEvent.setup()
        renderWithProviders(<AppShell />, { initialEntries: ['/login'] })
        await user.type(screen.getByLabelText(/^email$/i), 'demo@usdx.io')
        await user.type(screen.getByLabelText(/^password$/i), 'wrong-password')
        await user.click(screen.getByRole('button', { name: /^sign in$/i }))
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(/invalid credentials/i)
        expect(screen.queryByTestId('dashboard-stub')).not.toBeInTheDocument()
      })
    })
  })
})
