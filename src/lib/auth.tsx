import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Staff } from './types'
import { findStaffById } from '@/mocks/handlers'

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

interface PersistedSession {
  version: 3
  staffId: string
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
    if (parsed.version === 3 && parsed.staffId && parsed.token) {
      const matched = findStaffById(parsed.staffId)
      if (matched) return { user: matched, token: parsed.token }
    }
  } catch {
    // fall through
  }
  // v1 (legacy {id,name,email,role}) and v2 ({version:2,staffId}) sessions
  // pre-date JWT issuance; clear them so the user re-authenticates and we
  // mint a real token via /api/v1/auth/login.
  localStorage.removeItem(STORAGE_KEY)
  return null
}

// Response shapes mirror sot/openapi.yaml § /api/v1/auth/login.
interface LoginSuccessPayload {
  status: 'success'
  data: { accessToken: string; staff: Staff }
}

interface LoginErrorPayload {
  status?: 'error'
  error?: { code?: string; message?: string }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RestoredSession | null>(() => readPersistedSession())

  useEffect(() => {
    if (session) {
      const persisted: PersistedSession = {
        version: 3,
        staffId: session.user.id,
        token: session.token,
        issuedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [session])

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password) {
      throw new Error('Email and password are required')
    }
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      let message = 'Invalid email or password'
      try {
        const payload = (await response.json()) as LoginErrorPayload
        if (payload.error?.message) message = payload.error.message
      } catch {
        // keep default message
      }
      throw new Error(message)
    }
    const payload = (await response.json()) as LoginSuccessPayload
    const accessToken = payload.data?.accessToken
    const staff = payload.data?.staff
    if (!accessToken || !staff) {
      throw new Error('Malformed login response')
    }
    setSession({ user: staff, token: accessToken })
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
