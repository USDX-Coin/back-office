import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '@/lib/auth'
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
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ id: '1', name: 'Test User', email: 'test@usdx.com' })
      )
    }

    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </AuthProvider>
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
