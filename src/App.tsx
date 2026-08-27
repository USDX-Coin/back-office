import { lazy, Suspense } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  type RouteObject,
} from 'react-router'
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
import KycListPage from '@/features/kyc/KycListPage'
import KybListPage from '@/features/kyb/KybListPage'
import KybFormPage from '@/features/kyb/KybFormPage'
import MintListPage from '@/features/mint/MintListPage'
import MintFormPage from '@/features/mint/MintFormPage'
import BurnListPage from '@/features/burn/BurnListPage'
import BurnFormPage from '@/features/burn/BurnFormPage'
import TransactionsListPage from '@/features/transactions/TransactionsListPage'
import RatePage from '@/features/rate/RatePage'
import FeeConfigPage from '@/features/fee/FeeConfigPage'
import ThresholdPage from '@/features/threshold/ThresholdPage'
import TransparencyPage from '@/features/transparency/TransparencyPage'
import OncallContactsPage from '@/features/oncall/OncallContactsPage'
import ManualSyncPage from '@/features/manual-sync/ManualSyncPage'
import ProfilePage from '@/features/profile/ProfilePage'

// Code-split the Multisig route: the wallet stack (wagmi + RainbowKit, ~1MB)
// loads only when an operator opens /multisig, not on every page (USDX-275).
const MultisigRoute = lazy(() => import('@/features/multisig/MultisigRoute'))
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
//   /mint, /mint/:id    → Mint list + deep-link detail (admin/developer/manager)
//   /mint/new           → Mint form
//   /burn, /burn/:id    → Burn list + deep-link detail (admin/developer/manager)
//   /burn/new           → Burn form
//   /settings/rate      → Rate management
//   /settings/threshold → Threshold management
//   /transparency       → Reserve ledger + attestation reports (ADMIN + DEVELOPER)
//   /profile            → Operator profile (no sidebar entry; navbar dropdown)
//
// EXPORTED so tests can assert against the configuration that actually ships.
// A RoleGuard test that builds its own little route tree proves the component
// works and nothing about which roles this app grants — widening the
// /transparency guard to every role left the whole suite green.
// See src/components/layout/__tests__/AuthGuard.test.tsx.
// eslint-disable-next-line react-refresh/only-export-components
export const appRoutes: RouteObject[] = [
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
          // USDX-154 + week1.md § Authorization Guard: KYC review list is
          // reachable by every role (Admin/Manager/Staff/Developer) — no
          // RoleGuard. Approve/reject gating happens inside the detail
          // (USDX-155); BE enforces 403 for Developer regardless.
          { path: '/kyc', element: <KycListPage /> },
          { path: '/kyc/:id', element: <KycListPage /> },
          // USDX-546 — KYB review. Same visibility rule as KYC: the queue is
          // readable by every back-office role and the ACTIONS are gated inside
          // (DEVELOPER is view-only; the backend enforces 403 regardless), so no
          // RoleGuard here. `/kyb/new` exists because KYB is a MANUAL flow —
          // nothing but an operator creates these records.
          { path: '/kyb', element: <KybListPage /> },
          { path: '/kyb/new', element: <KybFormPage /> },
          { path: '/kyb/:id', element: <KybListPage /> },
          // USDX-206 + sot/phase-2/week2.md § Backoffice — User Transaction:
          // consumer-order monitoring, read-only, visible to every backoffice
          // role (no RoleGuard — like KYC). `/transactions/:id` re-renders the
          // list and opens the detail modal from URL state (deep-link safe).
          { path: '/transactions', element: <TransactionsListPage /> },
          { path: '/transactions/:id', element: <TransactionsListPage /> },
          {
            // USDX-78 + sot/phase-1.md L34: list `/mint` (and deep-link
            // `/mint/:id`) is admin/developer/manager only — STAFF redirects
            // to /mint/new.
            element: (
              <RoleGuard
                allowed={['ADMIN', 'DEVELOPER', 'MANAGER']}
                redirectTo="/mint/new"
              />
            ),
            children: [
              { path: '/mint', element: <MintListPage /> },
              { path: '/mint/:id', element: <MintListPage /> },
            ],
          },
          {
            // USDX-78 + sot/phase-1.md L34: list `/burn` (and deep-link
            // `/burn/:id`) is admin/developer/manager only — STAFF redirects
            // to /burn/new.
            element: (
              <RoleGuard
                allowed={['ADMIN', 'DEVELOPER', 'MANAGER']}
                redirectTo="/burn/new"
              />
            ),
            children: [
              { path: '/burn', element: <BurnListPage /> },
              { path: '/burn/:id', element: <BurnListPage /> },
            ],
          },
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
          // USDX-207 + sot/api/fee.yaml: read = all backoffice roles, update =
          // admin only (gated inside the page, read-only notice for non-admin —
          // same as Rate). No route-level RoleGuard so DEVELOPER can view.
          { path: '/settings/fee', element: <FeeConfigPage /> },
          {
            // KONTRAK-API-TRANSPARANSI.md § 3: reading the reserve ledger is
            // ADMIN + DEVELOPER. Gated at the ROUTE, like /settings/threshold —
            // the ledger exposes internal `reason` text and staff names that
            // never appear publicly, so hiding the buttons alone would still
            // leave the data one URL away. Recording entries is ADMIN-only
            // inside the page and the BE enforces that again (403).
            element: <RoleGuard allowed={['ADMIN', 'DEVELOPER']} />,
            children: [
              { path: '/transparency', element: <TransparencyPage /> },
            ],
          },
          {
            // sot/phase-1.md L516 "Threshold Management — admin only" +
            // Linear USDX-53 AC3: non-ADMIN must redirect/403.
            element: <RoleGuard allowed={['ADMIN']} />,
            children: [
              { path: '/settings/threshold', element: <ThresholdPage /> },
              // USDX-485 (audit alur uang P1-18): kontak on-call insiden uang.
              // ADMIN-only termasuk untuk MEMBACA — daftarnya memuat nomor
              // telepon (PII → ADMIN saja per conventions.md § Audit Akses PII)
              // dan menentukan siapa yang boleh menarik rem darurat payout.
              { path: '/settings/oncall', element: <OncallContactsPage /> },
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
          {
            // USDX-275 + sot/phase-1.md § Sidebar (TREASURY) + week4.md §
            // Backoffice Multisig Page: the Multisig queue is ADMIN / DEVELOPER /
            // MANAGER only (STAFF redirects — signer = Safe owner). The wallet
            // stack (wagmi/RainbowKit) wraps only this subtree so other pages
            // don't pull in the connectors / chain polling. `/multisig/:id`
            // re-renders the list and opens the detail drawer from URL state.
            element: <RoleGuard allowed={['ADMIN', 'DEVELOPER', 'MANAGER']} />,
            children: [
              {
                element: (
                  <Suspense
                    fallback={
                      <div className="p-8 text-sm text-muted-foreground">Loading…</div>
                    }
                  >
                    <Outlet />
                  </Suspense>
                ),
                children: [
                  // One splat route for both /multisig and /multisig/:id so
                  // MultisigRoute (and the wagmi/RainbowKit WalletProviders it
                  // hosts) mounts ONCE and survives opening the detail drawer.
                  // Two separate routes remounted the provider on navigate, and
                  // because reconnectOnMount is off (WalletProviders.tsx) the
                  // fresh mount reset to disconnected — the detail view then
                  // showed "Connect Wallet" again mid-session. MultisigListPage
                  // reads the :id via useMatch to open the drawer from URL state.
                  { path: '/multisig/*', element: <MultisigRoute /> },
                ],
              },
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
]

const router = createBrowserRouter(appRoutes)

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
