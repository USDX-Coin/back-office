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

  const login = useCallback(async (email: string, _password: string) => {
    // Mock login — accepts any non-empty credentials
    if (!email || !_password) {
      throw new Error('Email and password are required')
    }
    const mockUser: User = {
      id: '1',
      name: email.split('@')[0],
      email,
    }
    setUser(mockUser)
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
