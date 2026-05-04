import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { AuthProvider, useAuth } from '@/lib/auth'
import { server } from '@/mocks/server'
import { getDefaultStaff, resetMockData } from '@/mocks/handlers'
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

    test('should persist v3 session shape (staffId + token) in localStorage after login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'pw')
      })
      const stored = JSON.parse(localStorage.getItem('usdx_auth_user')!)
      expect(stored.version).toBe(3)
      expect(stored.staffId).toBe(result.current.user?.id)
      expect(stored.token).toBe(result.current.token)
      expect(typeof stored.issuedAt).toBe('number')
    })

    test('should restore Staff + token from v3 localStorage payload', () => {
      const seed = getDefaultStaff()!
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ version: 3, staffId: seed.id, token: 'a.b.c', issuedAt: Date.now() })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.id).toBe(seed.id)
      expect(result.current.token).toBe('a.b.c')
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

    test('should drop v3 payload whose staffId no longer exists', () => {
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
