import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Staff } from './types'
import { findStaffByEmail, findStaffById, getDefaultStaff } from '@/mocks/handlers'

interface AuthContextType {
  user: Staff | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'usdx_auth_user'

interface PersistedSession {
  version: 2
  staffId: string
}

function readPersistedStaff(): Staff | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession> & { email?: string }
    if (parsed.version === 2 && parsed.staffId) {
      return findStaffById(parsed.staffId) ?? null
    }
    // Legacy v1 → v2 migration: old shape was the full User object {id, name, email, role}
    if (parsed.email) {
      const matched = findStaffByEmail(parsed.email)
      if (matched) {
        const next: PersistedSession = { version: 2, staffId: matched.id }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return matched
      }
    }
  } catch {
    // fall through
  }
  localStorage.removeItem(STORAGE_KEY)
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(() => readPersistedStaff())

  useEffect(() => {
    if (user) {
      const session: PersistedSession = { version: 2, staffId: user.id }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password) {
      throw new Error('Email and password are required')
    }
    const matched = findStaffByEmail(email) ?? getDefaultStaff()
    if (!matched) throw new Error('No staff record available')
    setUser(matched)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
