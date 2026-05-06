import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Staff } from './types'
import { apiFetch, ApiError, configureApiFetch } from './apiFetch'

interface AuthContextType {
  user: Staff | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'usdx_auth_user'
const LOGIN_ENDPOINT = '/api/v1/auth/login'
const ME_ENDPOINT = '/api/v1/auth/me'

interface PersistedSession {
  version: 4
  staff: Staff
  token: string
  issuedAt: number
}

interface RestoredSession {
  user: Staff
  token: string
}

function readPersistedSession(): RestoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>
    if (parsed.version === 4 && parsed.staff && parsed.token) {
      // Trust the cached Staff record synchronously; /auth/me below
      // re-validates and refreshes from the server.
      return { user: parsed.staff, token: parsed.token }
    }
  } catch {
    // fall through
  }
  // Legacy versions (v1/v2/v3) pre-date the SoT-aligned Staff shape; clear
  // so the user re-authenticates and we restore a clean v4 record.
  localStorage.removeItem(STORAGE_KEY)
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RestoredSession | null>(() => readPersistedSession())
  // Mirror session in a ref so the configureApiFetch bindings always see the
  // freshest token without re-registering on every render.
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    if (session) {
      const persisted: PersistedSession = {
        version: 4,
        staff: session.user,
        token: session.token,
        issuedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [session])

  useEffect(() => {
    configureApiFetch({
      getToken: () => sessionRef.current?.token ?? null,
      onUnauthorized: () => setSession(null),
    })
  }, [])

  // Boot validation: when restored from localStorage, verify the token by
  // calling /api/v1/auth/me. apiFetch already calls onUnauthorized on 401.
  // We refresh the user record from the server response for freshness.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    apiFetch<Staff>(ME_ENDPOINT)
      .then((staff) => {
        if (cancelled) return
        if (staff && staff.id) {
          setSession((prev) => (prev ? { ...prev, user: staff } : prev))
        }
      })
      .catch(() => {
        // ApiError(401) already triggered onUnauthorized -> setSession(null).
        // Other errors (network down) we ignore so offline users stay signed in.
      })
    return () => {
      cancelled = true
    }
    // Run only when token identity changes — not on every staff refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password) {
      throw new Error('Email and password are required')
    }
    try {
      const data = await apiFetch<{ accessToken: string; staff: Staff }>(LOGIN_ENDPOINT, {
        method: 'POST',
        body: { email, password },
        skipAuth: true,
      })
      if (!data?.accessToken || !data?.staff) {
        throw new Error('Malformed login response')
      }
      setSession({ user: data.staff, token: data.accessToken })
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(err.message)
      }
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        token: session?.token ?? null,
        isAuthenticated: !!session,
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

// SoT phase-1.md § Roles: only Admin has CRUD on User Management.
export function canManageUsers(staff: Staff | null): boolean {
  return staff?.role === 'ADMIN'
}
