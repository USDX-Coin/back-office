import { createContext, useContext, useState, useCallback, useEffect } from 'react'
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

function parsePersistedSession(): Partial<PersistedSession> | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Partial<PersistedSession>
  } catch {
    return null
  }
}

function readPersistedSession(): RestoredSession | null {
  const parsed = parsePersistedSession()
  if (parsed && parsed.version === 4 && parsed.staff && parsed.token) {
    // Trust the cached Staff record synchronously; /auth/me below
    // re-validates and refreshes from the server.
    return { user: parsed.staff, token: parsed.token }
  }
  // Legacy versions (v1/v2/v3) pre-date the SoT-aligned Staff shape; clear
  // so the user re-authenticates and we restore a clean v4 record.
  if (localStorage.getItem(STORAGE_KEY)) localStorage.removeItem(STORAGE_KEY)
  return null
}

// USDX-58: bind apiFetch at module-load time, not inside a useEffect. React
// runs effects bottom-up, so child useQuery hooks would fire apiFetch before
// AuthProvider's effect had a chance to configure the bindings — the request
// went out with no Authorization header, the server replied 401, and by the
// time the 401 came back the onUnauthorized handler had been wired up to
// setSession(null), forcing a logout on every reload. Reading the token
// straight from localStorage on each call sidesteps the effect ordering
// entirely; AuthProvider just registers the logout setter.
let authSessionSetter: ((session: RestoredSession | null) => void) | null = null

configureApiFetch({
  getToken: () => {
    const parsed = parsePersistedSession()
    return parsed?.version === 4 && parsed.token ? parsed.token : null
  },
  onUnauthorized: () => authSessionSetter?.(null),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RestoredSession | null>(() => readPersistedSession())

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
    authSessionSetter = setSession
    return () => {
      authSessionSetter = null
    }
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

// SoT phase-1.md § Backoffice Role System ("Role Management") +
// sot/api/staff.yaml — only ADMIN can POST/PATCH/DELETE /api/v1/staff.
export function canManageStaff(staff: Staff | null): boolean {
  return staff?.role === 'ADMIN'
}

// SoT phase-1.md § Backoffice Role System: System Config = Ya untuk ADMIN dan
// DEVELOPER. USDX-50 Linear AC menulis "SETTINGS (admin only)" — kami
// expand ke ADMIN+DEVELOPER mengikuti capability table SoT (Flag-B di PR).
export function canManageSettings(staff: Staff | null): boolean {
  return staff?.role === 'ADMIN' || staff?.role === 'DEVELOPER'
}

// SoT phase-1.md § Backoffice Role System: DEVELOPER tidak boleh execute
// Mint/Burn (kolom Mint/Burn = Tidak). USDX-50 Flag-E: list page tetap
// visible untuk DEVELOPER (read-only), tapi tombol "Add Mint/Burn OTC"
// disembunyikan.
export function canSubmitOtc(staff: Staff | null): boolean {
  return staff?.role !== 'DEVELOPER' && staff !== null
}

// SoT phase-1.md § Reporting + § Backoffice Role System ("Reporting access"):
// Admin / Developer / Manager bisa akses report aggregate; Staff 403.
// Backend juga enforce 403 di GET /api/v1/reports/* — gate ini cuma supaya
// FE tidak render link/route ke role yang tidak berhak.
export function canAccessReports(staff: Staff | null): boolean {
  return (
    staff?.role === 'ADMIN' ||
    staff?.role === 'DEVELOPER' ||
    staff?.role === 'MANAGER'
  )
}

// USDX-155 — sot/phase-2/week1.md § Authorization Guard: approve/reject KYC
// is Staff/Manager/Admin; DEVELOPER is view-only (403 on POST). Drives the
// disabled state + tooltip on the Approve/Reject buttons in KycDetailModal —
// BE enforces the 403 regardless.
export function canReviewKyc(staff: Staff | null): boolean {
  return staff !== null && staff.role !== 'DEVELOPER'
}

// USDX-275 — sot/phase-1.md § Sidebar (TREASURY) + week4.md § Backoffice
// Multisig Page: the Multisig queue is visible to ADMIN / DEVELOPER / MANAGER
// (STAFF excluded — signer = Safe owner, typically Manager/Admin). Sign/Execute
// gating is enforced per-action inside the page (owner wallet); BE enforces the
// list/detail role check regardless.
export function canAccessTreasury(staff: Staff | null): boolean {
  return (
    staff?.role === 'ADMIN' ||
    staff?.role === 'DEVELOPER' ||
    staff?.role === 'MANAGER'
  )
}

// USDX-280 — sot/api/multisig.yaml § propose ("Akses: admin (ops sensitif)"):
// proposing a governance op (blacklist/pause/chain/role/timelock) is ADMIN-only.
// Gates the "Propose" button on /multisig; the BE enforces 403 regardless.
export function canProposeGovernance(staff: Staff | null): boolean {
  return staff?.role === 'ADMIN'
}

// USDX-78 — SoT phase-1.md L34: List Mint/Burn (/mint, /burn, /mint/:id,
// /burn/:id) "hanya bisa diakses Admin, Developer, dan Manager. Staff tidak
// boleh akses list/detail." Drives: route guard redirect target, Sidebar /
// MobileNavDrawer (STAFF → /mint/new instead of /mint, hide (N) badge), and
// the Dashboard "Pending requests" widget visibility.
export function canAccessRequestList(staff: Staff | null): boolean {
  return staff !== null && staff.role !== 'STAFF'
}
