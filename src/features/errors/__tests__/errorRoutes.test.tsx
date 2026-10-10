import { useEffect } from 'react'
import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { appRoutes } from '@/App'
import { AuthProvider, useAuth } from '@/lib/auth'
import { apiFetch, AUTH_ME_PATH } from '@/lib/apiFetch'
import { ThemeProvider } from '@/lib/theme'
import { server } from '@/mocks/server'
import { findStaffById, issueMockJwt, resetMockData } from '@/mocks/handlers'
import { createTestQueryClient } from '@/test/test-utils'

// Tiga tampilan baru, diuji lewat `appRoutes` — array yang benar-benar
// diserahkan ke `createBrowserRouter` — supaya yang terbukti adalah perilaku
// yang dikirim: 404 di dalam layout, 403 di tempat tanpa request halaman
// terlarang, dan sesi habis → Login dengan pesan + kembali ke halaman tadi.

// Seluruh suite paralel membuat render pertama appRoutes lambat; batas bawaan 1 dtk terlalu ketat.
const LAMBAT = { timeout: 8000 }

let requested: string[] = []
let auth: ReturnType<typeof useAuth> | null = null

function GrabAuth() {
  const ctx = useAuth()
  useEffect(() => {
    auth = ctx
  }, [ctx])
  return null
}

function clearCookies() {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  }
}

function seedProfile(staffId: string, { cookie = true } = {}) {
  const staff = findStaffById(staffId)!
  localStorage.setItem('usdx_auth_user', JSON.stringify({ version: 5, staff, issuedAt: Date.now() }))
  if (cookie) document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
}

function renderApp(entry: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [entry] })
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ThemeProvider>
        <AuthProvider>
          <GrabAuth />
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return router
}

const here = (router: ReturnType<typeof createMemoryRouter>) =>
  `${router.state.location.pathname}${router.state.location.search}`

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
  server.events.on('request:start', ({ request }) => {
    requested.push(new URL(request.url).pathname)
  })
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => {
  requested = []
  auth = null
  localStorage.clear()
  clearCookies()
  resetMockData()
})

describe('404 — halaman tidak ditemukan', () => {
  describe('positive', () => {
    test('should render the 404 page inside the layout with the opened path', async () => {
      seedProfile('stf_1')
      const router = renderApp('/halaman-yang-tidak-ada?x=1')
      expect(await screen.findByRole('heading', { name: /halaman tidak ditemukan/i }, LAMBAT)).toBeInTheDocument()
      expect(screen.getByTestId('route-notice-path')).toHaveTextContent('/halaman-yang-tidak-ada?x=1')
      expect(screen.getByRole('link', { name: /ke ringkasan/i })).toHaveAttribute('href', '/ringkasan')
      // URL tidak dialihkan; sidebar (layout) tetap ada.
      expect(here(router)).toBe('/halaman-yang-tidak-ada?x=1')
      expect(screen.getByRole('link', { name: /^ringkasan/i, hidden: false })).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test.each([
      ['/dashboard', '/ringkasan'],
      ['/', '/ringkasan'],
      ['/kyc', '/verifikasi?jenis=perorangan'],
    ])('should keep the intentional redirect %s → %s', async (from, to) => {
      seedProfile('stf_1')
      const router = renderApp(from)
      await waitFor(() => expect(here(router)).toBe(to), LAMBAT)
      expect(screen.queryByRole('heading', { name: /halaman tidak ditemukan/i })).not.toBeInTheDocument()
    })

    test.each([
      ['/mint', '/otc/mint'],
      ['/burn', '/otc/redeem'],
      ['/otc?jenis=burn', '/otc/redeem'],
    ])('should keep the legacy OTC redirect %s → %s for allowed roles', async (from, to) => {
      seedProfile('stf_1')
      const router = renderApp(from)
      await waitFor(() => expect(router.state.location.pathname).toBe(to), LAMBAT)
    })
  })

  describe('edge cases', () => {
    test('should send an unauthenticated visitor to Login first, keeping the path in ?next=', async () => {
      const router = renderApp('/tidak-ada')
      await waitFor(() => expect(here(router)).toBe('/login?next=%2Ftidak-ada'), LAMBAT)
      expect(screen.queryByTestId('session-expired-notice')).not.toBeInTheDocument()
    })
  })
})

describe('403 — tanpa akses', () => {
  describe('positive', () => {
    test('should show the 403 page in place with the role as a word', async () => {
      seedProfile('stf_4') // STAFF
      const router = renderApp('/jejak-audit')
      expect(await screen.findByRole('heading', { name: /kamu tidak punya akses ke halaman ini/i }, LAMBAT)).toBeInTheDocument()
      expect(screen.getByTestId('route-notice-role')).toHaveTextContent(/^Staf$/)
      expect(screen.getByText(/tidak terbuka untuk peran Staf/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /ke ringkasan/i })).toHaveAttribute('href', '/ringkasan')
      expect(here(router)).toBe('/jejak-audit')
    })
  })

  describe('negative', () => {
    test.each([
      ['/jejak-audit', '/api/v1/activity-logs'],
      ['/transparency', '/api/v1/transparency'],
      ['/settings/oncall', '/api/v1/oncall'],
      ['/reports/mint/daily', '/api/v1/reports'],
    ])('should never request the forbidden page data on %s', async (path, apiPrefix) => {
      seedProfile('stf_4') // STAFF
      renderApp(path)
      await screen.findByRole('heading', { name: /tidak punya akses/i })
      // beri waktu request apa pun yang mungkin menyusul
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      expect(requested.filter((p) => p.startsWith(apiPrefix))).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('should still let an allowed role through (gating unchanged)', async () => {
      seedProfile('stf_1') // ADMIN
      renderApp('/jejak-audit')
      await waitFor(() => expect(requested.some((p) => p.startsWith('/api/v1/activity-logs'))).toBe(true), LAMBAT)
      expect(screen.queryByRole('heading', { name: /tidak punya akses/i })).not.toBeInTheDocument()
    })

    test('should show 403 (not a redirect to /screening) for STAFF on /screening/lists', async () => {
      seedProfile('stf_4')
      const router = renderApp('/screening/lists')
      expect(await screen.findByRole('heading', { name: /tidak punya akses/i }, LAMBAT)).toBeInTheDocument()
      expect(here(router)).toBe('/screening/lists')
    })
  })
})

describe('sesi habis', () => {
  describe('positive', () => {
    test('should go to Login with the expired message, then back to the same page after login', async () => {
      seedProfile('stf_1')
      const router = renderApp('/users?search=budi')
      await screen.findByRole('heading', { name: /halaman tidak ditemukan|nasabah/i, level: 1 }).catch(() => null)

      server.use(
        http.get(AUTH_ME_PATH, () =>
          HttpResponse.json({ status: 'error', error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 }),
        ),
      )
      await act(async () => {
        await apiFetch(AUTH_ME_PATH).catch(() => {})
      })

      await waitFor(() => expect(here(router)).toBe('/login?next=%2Fusers%3Fsearch%3Dbudi'), LAMBAT)
      expect(await screen.findByTestId('session-expired-notice', {}, LAMBAT)).toHaveTextContent('Sesimu sudah habis, silakan masuk lagi.')
      expect(screen.getByText(/kembali ke halaman tadi/i)).toBeInTheDocument()

      server.resetHandlers()
      fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'admin@usdx.io' } })
      fireEvent.change(screen.getByLabelText(/^kata sandi$/i), { target: { value: 'admin123456' } })
      fireEvent.click(screen.getByRole('button', { name: /^masuk$/i }))
      await waitFor(() => expect(here(router)).toBe('/users?search=budi'), LAMBAT)
    })

    test('should treat a 401 on boot (stale cached profile) as an expired session', async () => {
      seedProfile('stf_1', { cookie: false })
      server.use(
        http.get(AUTH_ME_PATH, () =>
          HttpResponse.json({ status: 'error', error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 }),
        ),
      )
      const router = renderApp('/transactions')
      await waitFor(() => expect(here(router)).toBe('/login?next=%2Ftransactions'), LAMBAT)
      expect(await screen.findByTestId('session-expired-notice', {}, LAMBAT)).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should NOT show the expired message after a normal logout, and drop the path', async () => {
      seedProfile('stf_1')
      const router = renderApp('/transactions')
      await waitFor(() => expect(auth?.isAuthenticated).toBe(true), LAMBAT)
      act(() => auth!.logout())
      await waitFor(() => expect(here(router)).toBe('/login'), LAMBAT)
      expect(screen.queryByTestId('session-expired-notice')).not.toBeInTheDocument()
    })

    test.each([['//evil.com'], ['https://evil.com'], ['/\\evil.com']])(
      'should ignore next=%s and land on Ringkasan',
      async (next) => {
        const router = renderApp(`/login?next=${encodeURIComponent(next)}`)
        fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'admin@usdx.io' } })
        fireEvent.change(screen.getByLabelText(/^kata sandi$/i), { target: { value: 'admin123456' } })
        fireEvent.click(screen.getByRole('button', { name: /^masuk$/i }))
        await waitFor(() => expect(router.state.location.pathname).toBe('/ringkasan'), LAMBAT)
      },
    )

    test('should NOT show the expired message for a wrong password on the login page', async () => {
      server.use(
        http.post('/api/v1/auth/login', () =>
          HttpResponse.json({ status: 'error', error: { code: 'INVALID_CREDENTIALS', message: 'x' } }, { status: 401 }),
        ),
      )
      renderApp('/login')
      fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'admin@usdx.io' } })
      fireEvent.change(screen.getByLabelText(/^kata sandi$/i), { target: { value: 'salah' } })
      fireEvent.click(screen.getByRole('button', { name: /^masuk$/i }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/email atau kata sandi salah/i)
      expect(screen.queryByTestId('session-expired-notice')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should send an already signed-in visitor of /login?next= to that internal path', async () => {
      seedProfile('stf_1')
      const router = renderApp('/login?next=%2Fusers')
      await waitFor(() => expect(router.state.location.pathname).toBe('/users'), LAMBAT)
    })

    test('should not show the expired message from a crafted link (query is not the trigger)', async () => {
      renderApp('/login?next=%2Fusers&sessionExpired=true')
      await screen.findByLabelText(/^email$/i)
      expect(screen.queryByTestId('session-expired-notice')).not.toBeInTheDocument()
    })
  })
})
