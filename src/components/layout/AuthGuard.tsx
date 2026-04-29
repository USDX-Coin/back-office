import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/lib/auth'

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
    return <Navigate to="/user/internal" replace />
  }

  return <Outlet />
}
