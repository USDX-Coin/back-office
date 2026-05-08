import { Navigate, Outlet } from 'react-router'
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
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

// Role-based gate for already-authenticated users. Nest inside ProtectedRoute
// so this only runs once isAuthenticated is true. Non-allowed roles fall back
// to /dashboard (the default landing page) per Linear USDX-53 AC3
// ("redirect / 403"). Used for /settings/threshold (sot/phase-1.md L516
// "Threshold Management — admin only").
export function RoleGuard({ allowed }: { allowed: StaffRole[] }) {
  const { user } = useAuth()

  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
