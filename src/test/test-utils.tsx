import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { SidebarProvider } from '@/components/ui/sidebar'
import { getDefaultStaff } from '@/mocks/handlers'
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
        localStorage.setItem(
          'usdx_auth_user',
          JSON.stringify({ version: 2, staffId: staff.id })
        )
      }
    }

    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <NuqsTestingAdapter>
              <MemoryRouter initialEntries={initialEntries}>
                <SidebarProvider>{children}</SidebarProvider>
              </MemoryRouter>
            </NuqsTestingAdapter>
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
