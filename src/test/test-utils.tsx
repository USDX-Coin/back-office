import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import type { Staff } from '@/lib/types'
import type { ReactNode } from 'react'

interface WrapperOptions {
  initialEntries?: string[]
  /**
   * Seeds an authenticated `Staff` into localStorage so AuthProvider
   * hydrates synchronously. The bootstrap fetch to `/api/v1/auth/me` will
   * fail in jsdom (no network), but `AuthProvider` keeps the cached session
   * intact on NETWORK_ERROR, so the test sees a logged-in state.
   *
   * For real-BE flows (login submission, /auth/me round-trip, /requests data),
   * use the Playwright e2e suite (`e2e/usdx-39.spec.ts`).
   */
  authenticated?: boolean
}

const TEST_STAFF: Staff = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Demo Operator',
  email: 'demo@usdx.io',
  role: 'ADMIN',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function createWrapper({ initialEntries = ['/'], authenticated = false }: WrapperOptions = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = createTestQueryClient()

    if (authenticated) {
      localStorage.setItem('usdx_auth_token', 'test-token')
      localStorage.setItem('usdx_auth_staff', JSON.stringify(TEST_STAFF))
    }

    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: WrapperOptions & Omit<RenderOptions, 'wrapper'>
) {
  const { initialEntries, authenticated, ...renderOptions } = options || {}
  return render(ui, {
    wrapper: createWrapper({ initialEntries, authenticated }),
    ...renderOptions,
  })
}
