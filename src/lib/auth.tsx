import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from './types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'usdx_auth_user'

const DEMO_USER = {
  id: '1',
  name: 'Administrator',
  email: 'admin@usdx.com',
  role: 'Admin',
} as const

const DEMO_PASSWORD = 'Admin@2024!'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    if (email !== DEMO_USER.email || password !== DEMO_PASSWORD) {
      throw new Error('Invalid email or password')
    }
    setUser(DEMO_USER)
  }, [])

  const register = useCallback(async (name: string, email: string, _password: string) => {
    if (!name || !email || !_password) {
      throw new Error('All fields are required')
    }
    // Mock register — just validates, doesn't auto-login
  }, [])

  const forgotPassword = useCallback(async (email: string) => {
    if (!email) {
      throw new Error('Email is required')
    }
    // Mock forgot password — always succeeds
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
        register,
        forgotPassword,
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
