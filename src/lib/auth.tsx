import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Staff } from './types'
import { apiFetch, ApiError, AUTH_ME_PATH, configureApiFetch } from './apiFetch'

interface AuthContextType {
  user: Staff | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// USDX-392 (WSTG-CLNT-12): the session lives in an httpOnly cookie the server
// sets on POST /auth/login — it is never readable from JS, so an XSS payload
// cannot exfiltrate it. localStorage now only caches the *non-sensitive* Staff
// profile so the UI can render synchronously on reload without a login flash;
// GET /auth/me (authenticated by the cookie) re-validates it on every boot. No
// session token is stored client-side anymore.
const STORAGE_KEY = 'usdx_auth_user'
const LOGIN_ENDPOINT = '/api/v1/auth/login'
const LOGOUT_ENDPOINT = '/api/v1/auth/logout'
// Re-exported from apiFetch so the identity endpoint has exactly one spelling:
// apiFetch keys its "is the session really dead?" 401 re-check on the same path.
const ME_ENDPOINT = AUTH_ME_PATH

// Persisted profile shape. `version` gates migrations; anything below the
// current version — including the pre-USDX-392 shapes (v1–v4) that embedded a
// JWT — is discarded on read so any stale token is purged from storage.
const SESSION_VERSION = 5

interface PersistedProfile {
  version: typeof SESSION_VERSION
  staff: Staff
  issuedAt: number
}

function readPersistedStaff(): Staff | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  let parsed: Partial<PersistedProfile> | null = null
  try {
    parsed = JSON.parse(raw) as Partial<PersistedProfile>
  } catch {
    parsed = null
  }
  if (parsed && parsed.version === SESSION_VERSION && parsed.staff) {
    // Trust the cached Staff record synchronously; /auth/me below re-validates
    // it against the cookie and refreshes from the server.
    return parsed.staff
  }
  // Anything else (corrupt, legacy v1–v4 with an embedded token, or unknown
  // version) is dropped so we purge stale data and re-validate via the cookie.
  localStorage.removeItem(STORAGE_KEY)
  return null
}

// Register the "session expired" hook at module load so a 401 from any early
// request can clear the cached profile even before AuthProvider's effects run.
// The cookie itself is attached by the browser on every request regardless of
// React lifecycle, so there's no token-timing race to guard against anymore
// (the USDX-58 bearer-from-localStorage workaround is no longer needed).
let authSessionSetter: ((staff: Staff | null) => void) | null = null

configureApiFetch({
  onUnauthorized: () => authSessionSetter?.(null),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(() => readPersistedStaff())

  useEffect(() => {
    if (user) {
      const persisted: PersistedProfile = {
        version: SESSION_VERSION,
        staff: user,
        issuedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  useEffect(() => {
    authSessionSetter = setUser
    return () => {
      authSessionSetter = null
    }
  }, [])

  // Boot validation: confirm the session cookie is still valid by calling
  // /api/v1/auth/me. apiFetch sends the cookie (credentials:'include') and
  // fires onUnauthorized on 401, which clears the cached profile. A successful
  // call refreshes the Staff record from the server (source of truth).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    apiFetch<Staff>(ME_ENDPOINT)
      .then((staff) => {
        if (cancelled) return
        if (staff && staff.id) {
          setUser((prev) => (prev ? staff : prev))
        }
      })
      .catch(() => {
        // ApiError(401) already triggered onUnauthorized -> setUser(null).
        // Other errors (network down) we ignore so offline users stay signed in.
      })
    return () => {
      cancelled = true
    }
    // Run only when the signed-in identity changes — not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password) {
      throw new Error('Email and password are required')
    }
    try {
      // The server sets the httpOnly session cookie on this response. It also
      // still returns `accessToken` in the body for backward-compat during the
      // migration — we deliberately ignore it and never persist it (USDX-392).
      const data = await apiFetch<{ accessToken?: string; staff: Staff }>(LOGIN_ENDPOINT, {
        method: 'POST',
        body: { email, password },
      })
      if (!data?.staff) {
        throw new Error('Malformed login response')
      }
      setUser(data.staff)
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(err.message)
      }
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    // Clear client state first so the UI signs out immediately (no flicker on
    // the redirect to /login). The httpOnly cookie is independent of React
    // state, so it still rides along with the revoke call below.
    setUser(null)
    // Server-side revoke (USDX-392): invalidates the session server-side and
    // clears the cookie (Set-Cookie). Best-effort — the operator is already
    // signed out locally even if this fails (offline / session already gone).
    apiFetch(LOGOUT_ENDPOINT, { method: 'POST' }).catch(() => {})
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

// USDX-485 (audit alur uang P1-18) — kontak on-call insiden uang. Admin-only
// termasuk untuk MEMBACA, dan itu menyimpang dari Settings lain (rate/fee/
// threshold pakai canManageSettings = ADMIN+DEVELOPER untuk melihat). Dua
// alasan: (1) daftar ini menentukan siapa yang dipanggil saat uang bermasalah
// dan siapa yang boleh menarik rem darurat payout — pengetahuan yang berguna
// bagi orang yang ingin uangnya tidak direm; (2) `contactValue` bisa berupa
// nomor telepon, dan tabel role di sot/conventions.md § Audit Akses PII
// menaruh "Telepon" di kolom ADMIN saja. Backend juga 403 untuk role lain.
export function canManageOncall(staff: Staff | null): boolean {
  return staff?.role === 'ADMIN'
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

// USDX-588 — `screening.controller.ts` @Roles("STAFF","MANAGER","ADMIN") pada
// `POST /api/v1/screening/results/:id/decide`: DEVELOPER 403. Predikatnya sama
// isinya dengan canReviewKyc dan tetap ditulis terpisah — matriks role screening
// adalah matriks miliknya sendiri (controller-nya sendiri, alasannya sendiri),
// dan menumpanginya pada gerbang KYC berarti perubahan di satu sisi diam-diam
// memindahkan sisi yang lain. Preseden: canAccessReports vs canAccessTreasury.
export function canDecideScreening(staff: Staff | null): boolean {
  return staff !== null && staff.role !== 'DEVELOPER'
}

// USDX-588 — impor daftar sanksi + pemindaian ulang: MANAGER / ADMIN saja
// (`screening.controller.ts`, dan `sot/api/screening.yaml` § Akses). Lebih
// ketat daripada memutus satu temuan, dan alasannya ada di komentar controller:
// keduanya mengubah DASAR penilaian seluruh nasabah sekaligus. Daftar yang
// salah unggah membuat semua orang dinilai dengan ukuran yang keliru — bukan
// kewenangan yang sama dengan memutus satu berkas. BE menegakkan 403 sendiri.
export function canManageSanctionLists(staff: Staff | null): boolean {
  return staff?.role === 'ADMIN' || staff?.role === 'MANAGER'
}
