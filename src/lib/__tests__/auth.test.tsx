import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/lib/auth'
import type { ReactNode } from 'react'

// USDX-39: AuthProvider talks to the real BE (no MSW stubs). These tests
// only cover provider plumbing that is observable without an HTTP round-trip.
// Login / /auth/me / logout flows are verified end-to-end via Playwright
// (see `e2e/usdx-39.spec.ts`).

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  localStorage.clear()
})

describe('useAuth', () => {
  describe('edge cases', () => {
    test('should throw when used outside AuthProvider', () => {
      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider',
      )
    })

    test('should ignore corrupted cached staff JSON and start unauthenticated', () => {
      localStorage.setItem('usdx_auth_token', 'tok')
      localStorage.setItem('usdx_auth_staff', 'not-json')
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.user).toBeNull()
    })

    test('should start unauthenticated and not loading when no token cached', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })
})
