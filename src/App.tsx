import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { ProtectedRoute, PublicRoute } from '@/components/layout/AuthGuard'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import UsersPage from '@/features/users/UsersPage'
import StaffPage from '@/features/staff/StaffPage'
import OtcSplashPage from '@/features/otc/OtcSplashPage'
import OtcMintPage from '@/features/otc/mint/OtcMintPage'
import OtcRedeemPage from '@/features/otc/redeem/OtcRedeemPage'
import RequestsPage from '@/features/requests/RequestsPage'
import ReportPage from '@/features/report/ReportPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import ProfilePage from '@/features/profile/ProfilePage'
import { Toaster } from '@/components/ui/sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/staff', element: <StaffPage /> },
          { path: '/otc', element: <OtcSplashPage /> },
          { path: '/otc/mint', element: <OtcMintPage /> },
          { path: '/otc/redeem', element: <OtcRedeemPage /> },
          { path: '/requests', element: <RequestsPage /> },
          { path: '/report', element: <ReportPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
