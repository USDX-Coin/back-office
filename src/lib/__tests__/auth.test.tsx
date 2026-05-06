import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { AuthProvider, useAuth } from '@/lib/auth'
import { server } from '@/mocks/server'
import { getDefaultStaff, issueMockJwt, resetMockData } from '@/mocks/handlers'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  localStorage.clear()
  resetMockData()
})

describe('useAuth', () => {
  describe('positive', () => {
    test('should start unauthenticated', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })

    test('should login by calling /api/v1/auth/login and resolve to a Staff + JWT', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'anything')
      })
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe('demo@usdx.io')
      expect(result.current.user?.role).toBeDefined()
      expect(result.current.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    })

    test('should fall back to seeded default Staff when email does not match', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      const fallback = getDefaultStaff()
      await act(async () => {
        await result.current.login('unknown@example.com', 'pw')
      })
      expect(result.current.user?.id).toBe(fallback?.id)
    })

    test('should persist v4 session shape (staff + token) in localStorage after login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'pw')
      })
      const stored = JSON.parse(localStorage.getItem('usdx_auth_user')!)
      expect(stored.version).toBe(4)
      expect(stored.staff.id).toBe(result.current.user?.id)
      expect(stored.token).toBe(result.current.token)
      expect(typeof stored.issuedAt).toBe('number')
    })

    test('should restore Staff + token from v4 localStorage payload (valid JWT)', async () => {
      const seed = getDefaultStaff()!
      const token = issueMockJwt(seed)
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 4, staff: seed, token, issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      // /auth/me runs in a useEffect; isAuthenticated stays true throughout.
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
      expect(result.current.user?.id).toBe(seed.id)
      expect(result.current.token).toBe(token)
    })

    test('should logout and clear localStorage', async () => {
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
      expect(result.current.token).toBeNull()
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })
  })

  describe('boot validation via /auth/me', () => {
    test('should call /auth/me with the persisted Bearer token after restore', async () => {
      const seed = getDefaultStaff()!
      const token = issueMockJwt(seed)
      let captured = ''
      server.use(
        http.get('/api/v1/auth/me', ({ request }) => {
          captured = request.headers.get('Authorization') ?? ''
          return HttpResponse.json({ status: 'success', metadata: null, data: seed })
        })
      )
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 4, staff: seed, token, issuedAt: Date.now() })
      )
      renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(captured).toBe(`Bearer ${token}`))
    })

    test('should refresh user record from /auth/me response (server is source of truth)', async () => {
      const seed = getDefaultStaff()!
      const token = issueMockJwt(seed)
      const refreshed = { ...seed, name: 'Refreshed' }
      server.use(
        http.get('/api/v1/auth/me', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: refreshed })
        )
      )
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 4, staff: seed, token, issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.user?.name).toBe('Refreshed'))
    })

    test('should clear session when /auth/me returns 401 (token invalid/expired)', async () => {
      const seed = getDefaultStaff()!
      // Persist a structurally-valid v4 record but with a bogus signature so
      // the server rejects the token on /auth/me.
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({
          version: 4,
          staff: seed,
          token: 'header.body.tampered',
          issuedAt: Date.now(),
        })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      // Initial state is authenticated (synchronous restore from localStorage).
      expect(result.current.isAuthenticated).toBe(true)
      // /auth/me returns 401 -> apiFetch.onUnauthorized -> setSession(null).
      await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })

    test('should keep the user signed in when /auth/me errors with a non-401 (e.g. offline)', async () => {
      const seed = getDefaultStaff()!
      const token = issueMockJwt(seed)
      server.use(http.get('/api/v1/auth/me', () => HttpResponse.error()))
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 4, staff: seed, token, issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      // Wait long enough for the promise to settle, then assert no logout.
      await new Promise((r) => setTimeout(r, 30))
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('legacy session migration', () => {
    test('should clear pre-JWT v1 payloads and render unauthenticated', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ id: 'old-1', name: 'Demo Operator', email: 'demo@usdx.io', role: 'Admin' })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })

    test('should clear pre-JWT v2 payloads and render unauthenticated', () => {
      const seed = getDefaultStaff()!
      localStorage.setItem('usdx_auth_user', JSON.stringify({ version: 2, staffId: seed.id }))
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

    test('should ignore unknown version field', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 99, staffId: 'whatever', token: 'a.b.c' })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
    })

    test('should drop legacy v3 payload (pre-v4 staff-inline schema)', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 3, staffId: 'ghost', token: 'a.b.c', issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })
  })
})
