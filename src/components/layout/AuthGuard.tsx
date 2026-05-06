import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/lib/auth'

function BootstrapSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
    >
      Loading…
    </div>
  )
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <BootstrapSplash />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <Outlet />
}

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <BootstrapSplash />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
