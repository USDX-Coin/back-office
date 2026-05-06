import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { ProtectedRoute, PublicRoute } from '@/components/layout/AuthGuard'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { useAuth } from '@/lib/auth'

function ProtectedHome() {
  const { logout, user } = useAuth()
  return (
    <div>
      <p data-testid="protected">Protected · {user?.role}</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

function LoginStub() {
  return <div data-testid="login-stub">Login Page</div>
}

function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginStub />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<ProtectedHome />} />
      </Route>
    </Routes>
  )
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => localStorage.clear())

describe('AuthGuard (USDX-39)', () => {
  describe('AC #7: protected route without auth → /login', () => {
    test('should redirect to /login when no token present', async () => {
      renderWithProviders(<App />, { initialEntries: ['/dashboard'] })
      await waitFor(() =>
        expect(screen.getByTestId('login-stub')).toBeInTheDocument(),
      )
      expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    })
  })

  describe('AC #6: logout → token cleared and back to /login', () => {
    test('should clear token and unmount protected content after logout', async () => {
      const user = userEvent.setup()
      renderWithProviders(<App />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      // After bootstrap settles, protected content is visible
      await waitFor(() =>
        expect(screen.getByTestId('protected')).toBeInTheDocument(),
      )
      expect(localStorage.getItem('usdx_auth_token')).toBeTruthy()

      await user.click(screen.getByRole('button', { name: /logout/i }))
      await waitFor(() =>
        expect(screen.getByTestId('login-stub')).toBeInTheDocument(),
      )
      expect(localStorage.getItem('usdx_auth_token')).toBeNull()
      expect(localStorage.getItem('usdx_auth_staff')).toBeNull()
    })
  })

  describe('AC #3: bootstrap renders role from /auth/me', () => {
    test('should render role string from cached AuthStaff', async () => {
      renderWithProviders(<App />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      await waitFor(() =>
        expect(screen.getByTestId('protected')).toHaveTextContent(/ADMIN/),
      )
    })
  })

  describe('public route behavior', () => {
    test('should redirect /login → /dashboard when already authenticated', async () => {
      renderWithProviders(<App />, {
        initialEntries: ['/login'],
        authenticated: true,
      })
      await waitFor(() =>
        expect(screen.getByTestId('protected')).toBeInTheDocument(),
      )
    })
  })
})
