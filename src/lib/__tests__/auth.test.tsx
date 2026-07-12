import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { AuthProvider, useAuth } from '@/lib/auth'
import { server } from '@/mocks/server'
import { getDefaultStaff, issueMockJwt, resetMockData } from '@/mocks/handlers'
import type { ReactNode } from 'react'

// USDX-392 (WSTG-CLNT-12): auth moved onto an httpOnly session cookie. These
// tests drive the AuthProvider against the MSW mock, which authenticates via
// the `usdx_session` cookie (seeded here with `document.cookie`).

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

function seedSessionCookie(token: string) {
  document.cookie = `usdx_session=${token}; Path=/`
}

function clearCookies() {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  }
}

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  localStorage.clear()
  clearCookies()
  resetMockData()
})

describe('useAuth', () => {
  describe('positive', () => {
    test('should start unauthenticated', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    test('should login by calling /api/v1/auth/login and resolve to a Staff', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'anything')
      })
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe('demo@usdx.io')
      expect(result.current.user?.role).toBeDefined()
    })

    test('should fall back to seeded default Staff when email does not match', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      const fallback = getDefaultStaff()
      await act(async () => {
        await result.current.login('unknown@example.com', 'pw')
      })
      expect(result.current.user?.id).toBe(fallback?.id)
    })

    test('should persist the v5 profile (staff, no token) in localStorage after login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'pw')
      })
      const stored = JSON.parse(localStorage.getItem('usdx_auth_user')!)
      expect(stored.version).toBe(5)
      expect(stored.staff.id).toBe(result.current.user?.id)
      expect(stored.token).toBeUndefined()
      expect(typeof stored.issuedAt).toBe('number')
    })

    // Core WSTG-CLNT-12 assertion: no session token — even the accessToken the
    // backend still returns for backward-compat — is written to localStorage.
    test('should not store any session token in localStorage after login (USDX-392)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'pw')
      })
      const raw = localStorage.getItem('usdx_auth_user') ?? ''
      expect(raw).not.toContain('token')
      // The mock login returns a JWT (base64url segments start with `eyJ`, and
      // the signature is `mock-signature`). Assert none of it leaked to storage.
      expect(raw).not.toMatch(/eyJ|mock-signature/)
    })

    test('should restore Staff from a v5 profile + valid session cookie', async () => {
      const seed = getDefaultStaff()!
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 5, staff: seed, issuedAt: Date.now() })
      )
      seedSessionCookie(issueMockJwt(seed))
      const { result } = renderHook(() => useAuth(), { wrapper })
      // /auth/me runs in a useEffect; isAuthenticated stays true throughout.
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
      expect(result.current.user?.id).toBe(seed.id)
    })

    test('should call POST /auth/logout server-side and clear the session', async () => {
      let logoutCalls = 0
      server.use(
        http.post('/api/v1/auth/logout', () => {
          logoutCalls += 1
          return HttpResponse.json({ status: 'success', metadata: null, data: null })
        })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'pw')
      })
      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.logout()
      })
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
      // The server-side revoke fires asynchronously (best-effort).
      await waitFor(() => expect(logoutCalls).toBe(1))
    })
  })

  describe('boot validation via /auth/me', () => {
    test('should call /auth/me with the session cookie after restore', async () => {
      const seed = getDefaultStaff()!
      let capturedCookie = ''
      server.use(
        http.get('/api/v1/auth/me', ({ request }) => {
          capturedCookie = request.headers.get('cookie') ?? ''
          return HttpResponse.json({ status: 'success', metadata: null, data: seed })
        })
      )
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 5, staff: seed, issuedAt: Date.now() })
      )
      seedSessionCookie(issueMockJwt(seed))
      renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(capturedCookie).toContain('usdx_session='))
    })

    test('should refresh user record from /auth/me response (server is source of truth)', async () => {
      const seed = getDefaultStaff()!
      const refreshed = { ...seed, name: 'Refreshed' }
      server.use(
        http.get('/api/v1/auth/me', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: refreshed })
        )
      )
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 5, staff: seed, issuedAt: Date.now() })
      )
      seedSessionCookie(issueMockJwt(seed))
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.user?.name).toBe('Refreshed'))
    })

    test('should clear session when /auth/me returns 401 (cookie invalid/expired)', async () => {
      const seed = getDefaultStaff()!
      // Deterministic 401 regardless of cookie state — the cookie is missing
      // here, mirroring an expired/absent session on reload.
      server.use(
        http.get('/api/v1/auth/me', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Session expired' },
            },
            { status: 401 }
          )
        )
      )
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 5, staff: seed, issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      // Initial state is authenticated (synchronous restore from localStorage).
      expect(result.current.isAuthenticated).toBe(true)
      // /auth/me returns 401 -> apiFetch.onUnauthorized -> setUser(null).
      await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })

    test('should keep the user signed in when /auth/me errors with a non-401 (e.g. offline)', async () => {
      const seed = getDefaultStaff()!
      server.use(http.get('/api/v1/auth/me', () => HttpResponse.error()))
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 5, staff: seed, issuedAt: Date.now() })
      )
      seedSessionCookie(issueMockJwt(seed))
      const { result } = renderHook(() => useAuth(), { wrapper })
      // Wait long enough for the promise to settle, then assert no logout.
      await new Promise((r) => setTimeout(r, 30))
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('legacy session migration (pre-cookie tokens dropped)', () => {
    test('should clear pre-JWT v1 payloads and render unauthenticated', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ id: 'old-1', name: 'Demo Operator', email: 'demo@usdx.io', role: 'Admin' })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })

    test('should drop the v4 payload that embedded a session token (purge stale token)', () => {
      const seed = getDefaultStaff()!
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 4, staff: seed, token: issueMockJwt(seed), issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })
  })

  describe('negative', () => {
    test('should reject login with empty email (no HTTP call)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login('', 'pw')
        })
      ).rejects.toThrow()
      expect(result.current.user).toBeNull()
    })

    test('should reject login with empty password (no HTTP call)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login('demo@usdx.io', '')
        })
      ).rejects.toThrow()
      expect(result.current.user).toBeNull()
    })

    test('should surface server error message on 401 (SoT envelope)', async () => {
      server.use(
        http.post('/api/v1/auth/login', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Wrong password, friend.' },
            },
            { status: 401 }
          )
        )
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login('demo@usdx.io', 'pw')
        })
      ).rejects.toThrow('Wrong password, friend.')
      await waitFor(() => expect(result.current.user).toBeNull())
    })
  })

  describe('edge cases', () => {
    test('should throw when useAuth is used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')
    })

    test('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('usdx_auth_user', 'invalid-json')
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })

    test('should ignore an unknown version field', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 99, staff: getDefaultStaff(), issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })
  })
})
