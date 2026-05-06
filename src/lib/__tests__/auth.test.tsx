import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { server } from '@/mocks/server'
import { TEST_VALID_PASSWORD, TEST_AUTH_TOKEN, getTestAuthStaff } from '@/mocks/handlers'
import { ApiError } from '@/lib/api'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => {
  localStorage.clear()
})

describe('useAuth (USDX-39)', () => {
  describe('AC #1: login with real credentials', () => {
    test('should authenticate, store JWT and staff on success', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', TEST_VALID_PASSWORD)
      })
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe('demo@usdx.io')
      expect(result.current.user?.role).toBe('ADMIN')
      expect(localStorage.getItem('usdx_auth_token')).toBe(TEST_AUTH_TOKEN)
      expect(localStorage.getItem('usdx_auth_staff')).toContain('Demo Operator')
    })
  })

  describe('AC #2: login with wrong credentials', () => {
    test('should throw ApiError with the message from BE error envelope', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      let captured: unknown = null
      await act(async () => {
        try {
          await result.current.login('demo@usdx.io', 'wrong-password')
        } catch (err) {
          captured = err
        }
      })
      expect(captured).toBeInstanceOf(ApiError)
      expect((captured as ApiError).code).toBe('UNAUTHORIZED')
      expect((captured as ApiError).message).toBe('Invalid credentials')
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_token')).toBeNull()
    })
  })

  describe('AC #3: /auth/me bootstrap', () => {
    test('should hydrate AuthStaff from cache then revalidate via /auth/me', async () => {
      localStorage.setItem('usdx_auth_token', TEST_AUTH_TOKEN)
      localStorage.setItem(
        'usdx_auth_staff',
        JSON.stringify(getTestAuthStaff()),
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      // Synchronous: cached
      expect(result.current.user?.id).toBe(getTestAuthStaff().id)
      expect(result.current.isLoading).toBe(true)
      // After bootstrap settles
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.role).toBe('ADMIN')
    })

    test('should clear session when /auth/me returns 401 (expired token)', async () => {
      // Token without proper "Bearer " prefix would 401 — simulate by setting
      // a token, then the /auth/me handler returns 401 only when Authorization
      // header is missing. Force the 401 via override.
      localStorage.setItem('usdx_auth_token', TEST_AUTH_TOKEN)
      localStorage.setItem(
        'usdx_auth_staff',
        JSON.stringify(getTestAuthStaff()),
      )
      const { http, HttpResponse } = await import('msw')
      server.use(
        http.get('*/api/v1/auth/me', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Token expired' },
            },
            { status: 401 },
          ),
        ),
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_token')).toBeNull()
      expect(localStorage.getItem('usdx_auth_staff')).toBeNull()
    })
  })

  describe('AC #6: logout', () => {
    test('should clear token, cached staff, and user state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', TEST_VALID_PASSWORD)
      })
      expect(result.current.isAuthenticated).toBe(true)
      act(() => result.current.logout())
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('usdx_auth_token')).toBeNull()
      expect(localStorage.getItem('usdx_auth_staff')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should throw when used outside AuthProvider', () => {
      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider',
      )
    })

    test('should ignore corrupted cached staff JSON', () => {
      localStorage.setItem('usdx_auth_token', TEST_AUTH_TOKEN)
      localStorage.setItem('usdx_auth_staff', 'not-json')
      const { result } = renderHook(() => useAuth(), { wrapper })
      // Cached value rejected → user null until /auth/me resolves
      expect(result.current.user).toBeNull()
    })
  })
})
