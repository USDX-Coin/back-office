import { Navigate, Outlet, useLocation, useParams } from 'react-router'
import { useAuth } from '@/lib/auth'
import type { StaffRole } from '@/lib/types'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function PublicRoute() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/transactions" replace />
  }

  return <Outlet />
}

// Role-based gate for already-authenticated users. Nest inside ProtectedRoute
// so this only runs once isAuthenticated is true. Non-allowed roles fall back
// to `redirectTo` (default: /transactions — Beranda dihapus di redesain fase 1;
// Linear USDX-53 AC3 "redirect / 403").
// USDX-78 — STAFF on /mint or /burn redirects to /mint/new or /burn/new
// (sot/phase-1.md L34) so callers pass `redirectTo="/mint/new"` etc.
export function RoleGuard({
  allowed,
  redirectTo = '/transactions',
}: {
  allowed: readonly StaffRole[]
  redirectTo?: string
}) {
  const { user } = useAuth()

  if (!user || !allowed.includes(user.role)) {
    return <Navigate to={redirectTo} replace />
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
