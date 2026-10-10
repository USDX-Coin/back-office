import { Navigate, Outlet, useLocation, useParams, useSearchParams } from 'react-router'
import { useAuth } from '@/lib/auth'
import { DEFAULT_AFTER_LOGIN, loginPathWithNext, safeNextPath } from '@/lib/nextPath'
import type { StaffRole } from '@/lib/types'
import ForbiddenPage from '@/features/errors/ForbiddenPage'

/** State yang dibawa ke `/login` saat sesi habis — dibaca `LoginPage`. */
export interface LoginRedirectState {
  sessionExpired?: boolean
}

/**
 * Gerbang "harus masuk". Tanpa sesi:
 * - sesi baru saja HABIS (401) → `/login?next=<halaman ini>` + pesan "Sesimu
 *   sudah habis" (state router, jadi tidak bisa dipalsukan lewat tautan);
 * - belum pernah masuk (mis. membuka tautan langsung) → `/login?next=…` tanpa
 *   pesan;
 * - baru saja KELUAR → `/login` polos: keluar bukan sesi habis, dan halaman
 *   tempat ia keluar bukan tujuan berikutnya.
 */
export function ProtectedRoute() {
  const { isAuthenticated, sessionEnd } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    if (sessionEnd === 'logout') return <Navigate to="/login" replace />
    const here = `${location.pathname}${location.search}${location.hash}`
    const state: LoginRedirectState | undefined =
      sessionEnd === 'expired' ? { sessionExpired: true } : undefined
    return <Navigate to={loginPathWithNext(here)} state={state} replace />
  }

  return <Outlet />
}

/**
 * Halaman publik (Login). Sudah masuk → ke `?next=` bila itu path internal
 * yang sah (`safeNextPath` menolak `//evil.com`, `https://…`, `/\…`), selain
 * itu ke Ringkasan.
 */
export function PublicRoute() {
  const { isAuthenticated } = useAuth()
  const [params] = useSearchParams()

  if (isAuthenticated) {
    return <Navigate to={safeNextPath(params.get('next')) ?? DEFAULT_AFTER_LOGIN} replace />
  }

  return <Outlet />
}

/**
 * Gerbang peran untuk operator yang sudah masuk (dipasang di dalam
 * ProtectedRoute). Peran yang tidak diizinkan melihat halaman "Kamu tidak
 * punya akses" DI TEMPAT — URL tetap, sidebar tetap — alih-alih dialihkan diam-
 * diam ke halaman lain (dulu `/transactions`), yang membuat operator mengira
 * tautannya rusak. `<Outlet />` tidak dirender, jadi halaman terlarang tidak
 * pernah dipasang dan datanya tidak pernah diminta. `user === null` juga
 * ditolak (fail-closed).
 */
export function RoleGuard({ allowed }: { allowed: readonly StaffRole[] }) {
  const { user } = useAuth()

  if (!user || !allowed.includes(user.role)) {
    return <ForbiddenPage />
  }

  return <Outlet />
}

/**
 * Alihkan rute lama yang membawa `:id` ke rute barunya, mempertahankan id dan
 * query string (`/mint/abc?x=1` → `/otc/abc?x=1`). Dipakai supaya bookmark dan
 * tautan lama tidak mati saat menu dirombak (redesain fase 1).
 */
export function RedirectWithId({ to }: { to: string }) {
  const { id } = useParams<{ id: string }>()
  const { search } = useLocation()
  return <Navigate to={`${to}/${encodeURIComponent(id ?? '')}${search}`} replace />
}
