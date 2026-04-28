import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { getDefaultStaff, resetMockData } from '@/mocks/handlers'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

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
    })

    test('should login with any non-empty credentials and resolve to a Staff', async () => {
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

    test('should persist v2 session shape in localStorage after login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login('demo@usdx.io', 'pw')
      })
      const stored = JSON.parse(localStorage.getItem('usdx_auth_user')!)
      expect(stored.version).toBe(2)
      expect(stored.staffId).toBeDefined()
    })

    test('should restore Staff from v2 localStorage payload', () => {
      const seed = getDefaultStaff()!
      localStorage.setItem('usdx_auth_user', JSON.stringify({ version: 2, staffId: seed.id }))
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.id).toBe(seed.id)
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
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })
  })

  describe('v1 → v2 migration', () => {
    test('should migrate legacy {id,name,email,role} payload by email lookup', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ id: 'old-1', name: 'Demo Operator', email: 'demo@usdx.io', role: 'Admin' })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(true)
      // After migration, the storage shape should be v2
      const stored = JSON.parse(localStorage.getItem('usdx_auth_user')!)
      expect(stored.version).toBe(2)
      expect(stored.staffId).toBe(result.current.user?.id)
    })

    test('should clear localStorage and render unauthenticated when v1 email has no Staff match', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ id: 'x', name: 'Ghost', email: 'ghost@nowhere.invalid', role: 'X' })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })
  })

  describe('negative', () => {
    test('should reject login with empty email', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login('', 'pw')
        })
      ).rejects.toThrow()
      expect(result.current.user).toBeNull()
    })

    test('should reject login with empty password', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login('demo@usdx.io', '')
        })
      ).rejects.toThrow()
      expect(result.current.user).toBeNull()
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
      localStorage.setItem('usdx_auth_user', JSON.stringify({ version: 99, staffId: 'whatever' }))
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
    })
  })
})
