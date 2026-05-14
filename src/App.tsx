import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { ProtectedRoute, PublicRoute, RoleGuard } from '@/components/layout/AuthGuard'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import UsersPage from '@/features/users/UsersPage'
import UserDetailPage from '@/features/users/UserDetailPage'
import StaffPage from '@/features/staff/StaffPage'
import MintListPage from '@/features/mint/MintListPage'
import MintFormPage from '@/features/mint/MintFormPage'
import BurnListPage from '@/features/burn/BurnListPage'
import BurnFormPage from '@/features/burn/BurnFormPage'
import RatePage from '@/features/rate/RatePage'
import ThresholdPage from '@/features/threshold/ThresholdPage'
import ManualSyncPage from '@/features/manual-sync/ManualSyncPage'
import ProfilePage from '@/features/profile/ProfilePage'
import DailyMintReportPage from '@/features/reports/DailyMintPage'
import MintByUserReportPage from '@/features/reports/MintByUserPage'
import DailyBurnReportPage from '@/features/reports/DailyBurnPage'
import BurnByUserReportPage from '@/features/reports/BurnByUserPage'
import { Toaster } from '@/components/ui/sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

// Routing per Linear USDX-50 + sot/phase-1.md § Backoffice Web App.
//   /dashboard          → Dashboard
//   /users, /users/:id  → User management
//   /staff              → Staff management (admin sidebar gate)
//   /mint               → Mint list (table)  •  /mint/new → Mint form
//   /burn               → Burn list (table)  •  /burn/new → Burn form
//   /settings/rate      → Rate management
//   /settings/threshold → Threshold management
//   /profile            → Operator profile (no sidebar entry; navbar dropdown)
const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/users/:id', element: <UserDetailPage /> },
          { path: '/staff', element: <StaffPage /> },
          { path: '/mint', element: <MintListPage /> },
          { path: '/burn', element: <BurnListPage /> },
          {
            // USDX-23 + sot/phase-1.md § Backoffice Role System:
            // DEVELOPER kolom Mint/Burn = Tidak. List pages tetap visible
            // (read-only), tapi form submit di-gate. BE juga akan reject
            // 403; route-level gate mencegah DEVELOPER ngisi form lengkap
            // baru tau di-tolak.
            element: <RoleGuard allowed={['STAFF', 'MANAGER', 'ADMIN']} />,
            children: [
              { path: '/mint/new', element: <MintFormPage /> },
              { path: '/burn/new', element: <BurnFormPage /> },
            ],
          },
          { path: '/settings/rate', element: <RatePage /> },
          {
            // sot/phase-1.md L516 "Threshold Management — admin only" +
            // Linear USDX-53 AC3: non-ADMIN must redirect/403.
            element: <RoleGuard allowed={['ADMIN']} />,
            children: [
              { path: '/settings/threshold', element: <ThresholdPage /> },
            ],
          },
          {
            // USDX-81 + sot/phase-1.md § Reporting access: ADMIN/DEVELOPER/MANAGER.
            // STAFF redirect → /dashboard via RoleGuard.
            element: <RoleGuard allowed={['ADMIN', 'DEVELOPER', 'MANAGER']} />,
            children: [
              { path: '/reports/mint/daily', element: <DailyMintReportPage /> },
              { path: '/reports/mint/by-user', element: <MintByUserReportPage /> },
              { path: '/reports/burn/daily', element: <DailyBurnReportPage /> },
              { path: '/reports/burn/by-user', element: <BurnByUserReportPage /> },
            ],
          },
          // USDX-87 / sot/phase-1.md L583 — Manual Sync is reachable to every
          // authenticated role (on-call emergency surface). No RoleGuard.
          { path: '/manual-sync', element: <ManualSyncPage /> },
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
