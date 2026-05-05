import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { getDefaultStaff, findStaffById, issueMockJwt } from '@/mocks/handlers'
import type { ReactNode } from 'react'

interface WrapperOptions {
  initialEntries?: string[]
  authenticated?: boolean
  staffId?: string
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

function createWrapper({
  initialEntries = ['/'],
  authenticated = false,
  staffId,
}: WrapperOptions = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = createTestQueryClient()

    if (authenticated || staffId) {
      const staff = staffId ? findStaffById(staffId) : getDefaultStaff()
      if (staff) {
        // v3 session shape — auth.tsx requires a Bearer token to mark the
        // session authenticated and drive apiFetch's Authorization header.
        // issueMockJwt mints the same JWT the login handler does, so
        // strict-bearer handlers (mint/burn/rate POST) accept the session.
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
  const { initialEntries, authenticated, staffId, ...renderOptions } = options || {}
  return render(ui, {
    wrapper: createWrapper({ initialEntries, authenticated, staffId }),
    ...renderOptions,
  })
}
