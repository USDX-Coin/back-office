import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { getDefaultStaff, issueMockJwt } from '@/mocks/handlers'
import type { ReactNode } from 'react'

interface WrapperOptions {
  initialEntries?: string[]
  authenticated?: boolean
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
      const staff = getDefaultStaff()
      if (staff) {
        // Match the v3 schema AuthProvider expects (staffId + JWT bearer token).
        // Use issueMockJwt so the strict-bearer handlers (mint/burn) accept
        // the session.
        localStorage.setItem(
          'usdx_auth_user',
          JSON.stringify({
            version: 3,
            staffId: staff.id,
            token: issueMockJwt(staff),
            issuedAt: Date.now(),
          })
        )
      }
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
