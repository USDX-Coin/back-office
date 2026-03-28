import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/lib/auth'
import type { ReactNode } from 'react'

const DEMO_EMAIL = 'admin@usdx.com'
const DEMO_PASSWORD = 'Admin@2024!'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  localStorage.clear()
})

describe('useAuth', () => {
  describe('positive', () => {
    test('should start unauthenticated', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    test('should login with valid demo credentials', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login(DEMO_EMAIL, DEMO_PASSWORD)
      })
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe(DEMO_EMAIL)
      expect(result.current.user?.name).toBe('Administrator')
      expect(result.current.user?.role).toBe('Admin')
    })

    test('should persist user in localStorage after login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login(DEMO_EMAIL, DEMO_PASSWORD)
      })
      const stored = JSON.parse(localStorage.getItem('usdx_auth_user')!)
      expect(stored.email).toBe(DEMO_EMAIL)
    })

    test('should restore user from localStorage', () => {
      localStorage.setItem(
        'usdx_auth_user',
        JSON.stringify({ id: '1', name: 'Administrator', email: DEMO_EMAIL, role: 'Admin' })
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe(DEMO_EMAIL)
    })

    test('should logout and clear localStorage', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.login(DEMO_EMAIL, DEMO_PASSWORD)
      })
      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.logout()
      })
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('usdx_auth_user')).toBeNull()
    })

    test('should register without auto-login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.register('John', 'john@usdx.com', 'password123')
      })
      expect(result.current.isAuthenticated).toBe(false)
    })

    test('should send forgot password without error', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await act(async () => {
        await result.current.forgotPassword(DEMO_EMAIL)
      })
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('negative', () => {
    test('should throw on login with wrong email', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login('wrong@usdx.com', DEMO_PASSWORD)
        })
      ).rejects.toThrow('Invalid email or password')
    })

    test('should throw on login with wrong password', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login(DEMO_EMAIL, 'wrongpassword')
        })
      ).rejects.toThrow('Invalid email or password')
    })

    test('should throw on login with empty credentials', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.login('', '')
        })
      ).rejects.toThrow('Invalid email or password')
    })

    test('should throw on register with empty fields', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.register('', 'john@usdx.com', 'password123')
        })
      ).rejects.toThrow('All fields are required')
    })

    test('should throw on forgot password with empty email', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await expect(
        act(async () => {
          await result.current.forgotPassword('')
        })
      ).rejects.toThrow('Email is required')
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
      expect(() => {
        renderHook(() => useAuth(), { wrapper })
      }).toThrow()
    })
  })
})
