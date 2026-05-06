import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'
import type { ReactNode } from 'react'
import type { Staff, AuthToken } from './types'
import {
  apiFetch,
  setAuthToken,
  getAuthToken,
  ApiError,
  UNAUTHORIZED_EVENT,
} from './api'

interface AuthContextType {
  user: Staff | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const STAFF_CACHE_KEY = 'usdx_auth_staff'

function readCachedStaff(): Staff | null {
  const raw = localStorage.getItem(STAFF_CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Staff
    if (parsed && typeof parsed.id === 'string' && typeof parsed.role === 'string') {
      return parsed
    }
  } catch {
    /* fall through */
  }
  localStorage.removeItem(STAFF_CACHE_KEY)
  return null
}

function writeCachedStaff(staff: Staff | null): void {
  if (staff) localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(staff))
  else localStorage.removeItem(STAFF_CACHE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(() => {
    // Hydrate from cache only when we also still have a token.
    return getAuthToken() ? readCachedStaff() : null
  })
  const [isLoading, setIsLoading] = useState<boolean>(() => !!getAuthToken())

  const clearSession = useCallback(() => {
    setAuthToken(null)
    writeCachedStaff(null)
    setUser(null)
  }, [])

  // Bootstrap: if a token exists at mount, verify it via /auth/me.
  // No mount-once guard — under StrictMode the effect runs twice; the
  // `cancelled` flag drops the first run and the second run wins.
  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const { data } = await apiFetch<Staff>('/api/v1/auth/me')
        if (cancelled) return
        writeCachedStaff(data)
        setUser(data)
      } catch (err) {
        if (cancelled) return
        // Any error during bootstrap → drop the session. apiFetch already
        // cleared the token on 401; clearSession is idempotent.
        if (!(err instanceof ApiError) || err.code !== 'NETWORK_ERROR') {
          clearSession()
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clearSession])

  // Global 401 listener: if any request returns 401, clear the session so
  // the next render redirects to /login.
  useEffect(() => {
    function handleUnauthorized() {
      writeCachedStaff(null)
      setUser(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiFetch<AuthToken>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    })
    setAuthToken(data.accessToken)
    writeCachedStaff(data.staff)
    setUser(data.staff)
  }, [])

  const logout = useCallback(() => {
    clearSession()
  }, [clearSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
