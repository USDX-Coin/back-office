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
import { DURIANPAY_API_CALLS_ROLES } from '@/lib/types'
import { ThemeProvider } from '@/lib/theme'
import {
  ProtectedRoute,
  PublicRoute,
  RedirectWithId,
  RoleGuard,
} from '@/components/layout/AuthGuard'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/features/auth/LoginPage'
import UsersPage from '@/features/users/UsersPage'
import UserDetailPage from '@/features/users/UserDetailPage'
import StaffPage from '@/features/staff/StaffPage'
import VerificationPage from '@/features/verification/VerificationPage'
import KybFormPage from '@/features/kyb/KybFormPage'
import ScreeningQueuePage from '@/features/screening/ScreeningQueuePage'
import SanctionListsPage from '@/features/screening/SanctionListsPage'
import MintFormPage from '@/features/mint/MintFormPage'
import BurnFormPage from '@/features/burn/BurnFormPage'
import TransactionsPage from '@/features/transactions/TransactionsPage'
import OverviewPage from '@/features/overview/OverviewPage'
import RedeemApprovalsPage from '@/features/redeem-approvals/RedeemApprovalsPage'
import PayoutFailuresPage from '@/features/payout-failures/PayoutFailuresPage'
import HeldCreditsPage from '@/features/held-credits/HeldCreditsPage'
import ApprovalsPage from '@/features/approvals/ApprovalsPage'
import PayoutControlsPage from '@/features/payout-controls/PayoutControlsPage'
import ActivityLogPage from '@/features/activity-log/ActivityLogPage'
import RatePage from '@/features/rate/RatePage'
import FeeConfigPage from '@/features/fee/FeeConfigPage'
import MintModePage from '@/features/mint-mode/MintModePage'
import ThresholdPage from '@/features/threshold/ThresholdPage'
import TransparencyPage from '@/features/transparency/TransparencyPage'
import OncallContactsPage from '@/features/oncall/OncallContactsPage'
import ManualSyncPage from '@/features/manual-sync/ManualSyncPage'
import PaymentMethodsPage from '@/features/payment-methods/PaymentMethodsPage'
import BniAccountsPage from '@/features/bni-accounts/BniAccountsPage'
import DurianpayApiCallsPage from '@/features/durianpay-api-calls/DurianpayApiCallsPage'
import ProfilePage from '@/features/profile/ProfilePage'
import NotFoundPage from '@/features/errors/NotFoundPage'

// Code-split the Multisig route: the wallet stack (wagmi + RainbowKit, ~1MB)
// loads only when an operator opens /multisig, not on every page (USDX-275).
const MultisigRoute = lazy(() => import('@/features/multisig/MultisigRoute'))
// Same reason for OTC: its detail panel signs/executes Safe transactions.
const OtcRoute = lazy(() => import('@/features/otc/OtcRoute'))
import OtcLegacyRedirect from '@/features/otc/OtcLegacyRedirect'
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
//   /dashboard          → redirect /ringkasan (Beranda lama → Ringkasan, 10 Okt 2026)
//   /users, /users/:id  → User management
//   /staff              → Staff management (admin sidebar gate)
//   /mint, /mint/:id    → Mint list + deep-link detail (admin/developer/manager)
//   /mint/new           → Mint form
//   /burn, /burn/:id    → Burn list + deep-link detail (admin/developer/manager)
//   /burn/new           → Burn form
//   /settings/rate      → Rate management
//   /settings/threshold → Threshold management
//   /transparency       → Reserve ledger + attestation reports (ADMIN + DEVELOPER)
//   /bni-accounts       → Rekening BNI: LIVE balances + statements (every role)
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
          // Ringkasan (keputusan PM 10 Okt 2026) — halaman pertama setelah
          // masuk, semua peran. `/dashboard` (Beranda lama) dialihkan ke sini.
          { path: '/ringkasan', element: <OverviewPage /> },
          // `/` (akar) tetap pengalihan sengaja ke Ringkasan — dulu lewat `*`.
          { path: '/', element: <Navigate to="/ringkasan" replace /> },
          { path: '/dashboard', element: <Navigate to="/ringkasan" replace /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/users/:id', element: <UserDetailPage /> },
          { path: '/staff', element: <StaffPage /> },
          // Redesain fase 1 — Verifikasi: antrean KYC perorangan (USDX-154) dan
          // KYB badan usaha (USDX-546) jadi SATU tabel. Aturan visibilitasnya
          // tidak berubah: terbuka untuk semua peran (server: STAFF / MANAGER /
          // ADMIN / DEVELOPER), MEMUTUSKAN digerbangi di dalam berkas lengkap
          // (DEVELOPER hanya melihat; backend menegakkan 403), jadi tanpa
          // RoleGuard.
          //
          // `/verifikasi/:jenis/:id` membuka modal berkas lengkap (foto KTP,
          // dokumen badan usaha) di tengah, di atas tabel Verifikasi yang tetap
          // lebar penuh. Rute lama `/kyc/:id` dan `/kyb/:id` membuka modal yang
          // SAMA supaya tautan lama tetap hidup. `/kyc` dan `/kyb` dialihkan ke
          // Verifikasi dengan saringan Jenis terpasang. `/kyb/new` (form KYB
          // manual) tetap.
          { path: '/verifikasi', element: <VerificationPage /> },
          { path: '/verifikasi/:jenis/:id', element: <VerificationPage /> },
          { path: '/kyc', element: <Navigate to="/verifikasi?jenis=perorangan" replace /> },
          { path: '/kyc/:id', element: <VerificationPage detail="perorangan" /> },
          { path: '/kyb', element: <Navigate to="/verifikasi?jenis=badan-usaha" replace /> },
          { path: '/kyb/new', element: <KybFormPage /> },
          { path: '/kyb/:id', element: <VerificationPage detail="badan-usaha" /> },
          // USDX-588 — antrean screening DTTOT & DPPSPM. Aturan visibilitas sama
          // dengan KYC/KYB: antreannya terbuka untuk semua role back office
          // (server: STAFF/MANAGER/ADMIN/DEVELOPER) dan MEMUTUSKAN digerbangi di
          // dalam layar bandingnya (DEVELOPER 403), jadi tidak ada RoleGuard di
          // sini. `/screening/:id` merender ulang antrean dan membuka layar
          // banding dari URL — aman untuk deep link.
          //
          // `/screening/lists` didaftarkan SEBELUM `/screening/:id` hanya demi
          // kejelasan bagi pembaca: React Router v7 memberi peringkat lebih
          // tinggi pada segmen statis daripada segmen dinamis, jadi urutannya
          // sendiri tidak menentukan — tapi seseorang yang membaca daftar ini
          // tidak perlu tahu itu untuk yakin `/screening/lists` tidak dibaca
          // sebagai sebuah id.
          { path: '/screening', element: <ScreeningQueuePage /> },
          {
            // USDX-588: impor daftar sanksi + pemindaian ulang MANAGER / ADMIN
            // saja, dan digerbangi di ROUTE — bukan hanya tombolnya. Keduanya
            // mengubah DASAR penilaian SELURUH nasabah sekaligus
            // (`screening.controller.ts`), jadi menyembunyikan tombol saja tetap
            // meninggalkan halamannya sejauh satu URL. BE menegakkan 403 juga.
            element: <RoleGuard allowed={['ADMIN', 'MANAGER']} />,
            children: [{ path: '/screening/lists', element: <SanctionListsPage /> }],
          },
          { path: '/screening/:id', element: <ScreeningQueuePage /> },
          // USDX-206 + sot/phase-2/week2.md § Backoffice — User Transaction:
          // consumer-order monitoring, read-only, visible to every backoffice
          // role (no RoleGuard — like KYC). `/transactions/:id` re-renders the
          // list and opens the detail modal from URL state (deep-link safe).
          { path: '/transactions', element: <TransactionsPage /> },
          { path: '/transactions/:id', element: <TransactionsPage /> },
          // USDX-669 — antrean Persetujuan Pencairan. TANPA RoleGuard, dan itu
          // disengaja: kontraknya (`sot/api/redeem-approvals.yaml § Akses`) membuka
          // list + detail untuk STAFF / MANAGER / ADMIN / DEVELOPER, dan MENYETUJUI
          // / MENOLAK digerbangi MANAGER/ADMIN di dalam layarnya. Pola yang sama
          // dengan /kyc, /kyb dan /screening: antrean kerja terbuka, aksinya
          // digerbangi, backend menegakkan 403 sendiri. Menggerbangi rutenya akan
          // menyembunyikan antrean yang menumpuk dari STAFF, yaitu orang yang
          // biasanya lebih dulu menyadarinya.
          { path: '/redeem-approvals', element: <RedeemApprovalsPage /> },
          // USDX-662 — antrean Pencairan Bermasalah (§ 17.9). TANPA RoleGuard, alasan
          // yang sama dengan /redeem-approvals: list + detail terbuka untuk semua peran
          // back office (`sot/api/payout-failures.yaml § Akses`), resolve digerbangi
          // MANAGER/ADMIN di dalam layar dan ditegakkan 403 oleh backend.
          { path: '/payout-failures', element: <PayoutFailuresPage /> },
          { path: '/payout-failures/:id', element: <PayoutFailuresPage /> },
          // USDX-342 — antrean Mint Bermasalah (kredit masuk yang tertahan,
          // `sot/bni-integration.md § 6`). TANPA RoleGuard, alasan yang sama
          // dengan /payout-failures: `HeldCreditsController` membuka list +
          // detail untuk keempat peran dan menutup RESOLVE untuk DEVELOPER
          // (403), jadi yang digerbangi adalah aksinya, di dalam layar.
          // Menggerbangi rutenya akan menyembunyikan uang nasabah yang belum
          // jadi USDX dari peran yang paling sering melihat antrean lebih dulu.
          { path: '/mint-bermasalah', element: <HeldCreditsPage /> },
          { path: '/mint-bermasalah/:id', element: <HeldCreditsPage /> },
          // USDX-486 — antrean maker-checker. TANPA RoleGuard: `ApprovalsController`
          // membuka list + detail untuk keempat peran justru supaya PENGUSUL bisa
          // melihat nasib usulannya sendiri; memutuskan digerbangi MANAGER/ADMIN di
          // dalam layar, dengan alasannya ditulis saat tombolnya mati.
          { path: '/persetujuan', element: <ApprovalsPage /> },
          { path: '/persetujuan/:id', element: <ApprovalsPage /> },
          // Plafon pencairan. TANPA RoleGuard: `GET /api/v1/payout-controls`
          // terbuka untuk keempat peran karena keadaan rem harus bisa dilihat
          // cepat saat insiden. MENGUBAH plafon dan MEMBACA RIWAYATNYA
          // (MANAGER/ADMIN) digerbangi per-bagian di dalam halaman — dua gerbang
          // berbeda di satu layar tidak bisa diwakili satu gerbang rute.
          { path: '/plafon-pencairan', element: <PayoutControlsPage /> },
          {
            // OTC ▸ Mint `/otc/mint` + OTC ▸ Redeem `/otc/redeem` (keputusan PM
            // 10 Okt 2026; fase 1 masih satu tabel `/otc`).
            // Gerbangnya tetap sot/phase-1.md L34 (USDX-78): list + detail
            // `/api/v1/requests` dan `/api/v1/multisig` hanya ADMIN / DEVELOPER /
            // MANAGER. STAFF melihat halaman 403 di tempat, karena menu OTC memang
            // disembunyikan untuknya.
            //
            // `/otc/mint/:id` merender ulang tabel dan membuka modal detail dari
            // URL, jadi tautan langsung dan tombol kembali peramban tetap
            // bekerja. Rute lama `/otc`, `/otc/:id`, `/mint`, `/burn` (+ `/:id`)
            // dialihkan ke sub-menu supaya bookmark lama tidak mati.
            element: <RoleGuard allowed={['ADMIN', 'DEVELOPER', 'MANAGER']} />,
            children: [
              {
                element: (
                  <Suspense
                    fallback={<div className="p-8 text-sm text-muted-foreground">Memuat…</div>}
                  >
                    <Outlet />
                  </Suspense>
                ),
                children: [
                  { path: '/otc/mint', element: <OtcRoute type="mint" /> },
                  { path: '/otc/mint/:id', element: <OtcRoute type="mint" /> },
                  { path: '/otc/redeem', element: <OtcRoute type="burn" /> },
                  { path: '/otc/redeem/:id', element: <OtcRoute type="burn" /> },
                ],
              },
              { path: '/otc', element: <OtcLegacyRedirect /> },
              { path: '/otc/:id', element: <OtcLegacyRedirect /> },
              { path: '/mint', element: <Navigate to="/otc/mint" replace /> },
              { path: '/mint/:id', element: <RedirectWithId to="/otc/mint" /> },
              { path: '/burn', element: <Navigate to="/otc/redeem" replace /> },
              { path: '/burn/:id', element: <RedirectWithId to="/otc/redeem" /> },
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
          // USDX-639 — mode mint PROD/UJI. TANPA RoleGuard, dan itu disengaja:
          // AC tiketnya menuntut STAFF bisa MEMBUKA halaman ini (tombol kembali
          // ke PROD tersedia untuk STAFF ke atas), sementara Settings lain
          // berhenti di ADMIN+DEVELOPER. Kewenangan menggeser di-gate di dalam
          // kartunya per aksi, dan backend menegakkan 403 sendiri.
          { path: '/settings/mint-mode', element: <MintModePage /> },
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
              // Modal detail baris (11 Okt 2026): entri buku besar & laporan atestasi.
              { path: '/transparency/entri/:id', element: <TransparencyPage /> },
              { path: '/transparency/laporan/:id', element: <TransparencyPage /> },
              // ⚠️ DRAF SOT PR #50 — GET Admin + Developer (read-only), ubah Admin.
              { path: '/settings/payment-methods', element: <PaymentMethodsPage /> },
            ],
          },
          {
            // sot/phase-1.md L516 "Threshold Management — admin only" +
            // Linear USDX-53 AC3: non-ADMIN must redirect/403.
            element: <RoleGuard allowed={['ADMIN']} />,
            children: [
              { path: '/settings/threshold', element: <ThresholdPage /> },
              // Jejak Audit — `GET /api/v1/activity-logs` adalah `@Roles("ADMIN")`,
              // satu-satunya peran. Digerbangi DI ROUTE, bukan hanya di menu:
              // menu yang disembunyikan tetap meninggalkan halamannya sejauh satu
              // URL, dan 403 dari server dibaca operator sebagai layar rusak.
              { path: '/jejak-audit', element: <ActivityLogPage /> },
              // Modal detail satu baris jejak (deep link, ↑/↓) — gerbang yang sama.
              { path: '/jejak-audit/:id', element: <ActivityLogPage /> },
              // USDX-485 (audit alur uang P1-18): kontak on-call insiden uang.
              // ADMIN-only termasuk untuk MEMBACA — daftarnya memuat nomor
              // telepon (PII → ADMIN saja per conventions.md § Audit Akses PII)
              // dan menentukan siapa yang boleh menarik rem darurat payout.
              { path: '/settings/oncall', element: <OncallContactsPage /> },
            ],
          },
          {
            // USDX-81 + sot/phase-1.md § Reporting access: ADMIN/DEVELOPER/MANAGER.
            // STAFF melihat halaman 403 (RoleGuard), tanpa request laporan.
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
            // MANAGER only (STAFF sees the 403 page — signer = Safe owner). The wallet
            // stack (wagmi/RainbowKit) wraps only this subtree so other pages
            // don't pull in the connectors / chain polling. `/multisig/:id`
            // re-renders the list and opens the detail drawer from URL state.
            element: <RoleGuard allowed={['ADMIN', 'DEVELOPER', 'MANAGER']} />,
            children: [
              {
                element: (
                  <Suspense
                    fallback={
                      <div className="p-8 text-sm text-muted-foreground">Memuat…</div>
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
          // USDX-631 / sot/bni-integration.md § 16 K5 — Rekening BNI is a
          // read-only surface for EVERY role including STAFF (PM decision
          // 2026-09-09); the backend enforces `@Roles` on all four. Flat
          // route, no RoleGuard — AuthGuard.test.tsx pins this.
          { path: '/bni-accounts', element: <BniAccountsPage /> },
          // USDX-87 / sot/phase-1.md L583 — Manual Sync is reachable to every
          // authenticated role (on-call emergency surface). No RoleGuard.
          { path: '/manual-sync', element: <ManualSyncPage /> },
          {
            // Log Panggilan DurianPay — DIGERBANGI DI ROUTE, bukan hanya di
            // menunya. Menyembunyikan entri sidebar tanpa menggerbangi rutenya
            // meninggalkan halaman yang tetap bisa dibuka dengan mengetik URL-nya,
            // lalu setiap permintaannya gagal 403 dan layarnya terbaca sebagai
            // rusak, bukan sebagai terlarang.
            //
            // Daftar perannya diimpor, TIDAK ditulis ulang di sini. Sebelumnya
            // baris ini memuat literalnya sendiri sementara komentarnya mengklaim
            // daftar itu "hidup sekali" — dan saat backend membuka layar ini untuk
            // STAFF, gerbang menu ikut terbuka tapi gerbang rute ini tidak. Satu
            // sumber, satu tempat berubah.
            // `/durianpay-api-calls/:id` merender ulang daftar dan membuka detail
            // dari URL — aman untuk deep link (pola /payout-failures).
            element: <RoleGuard allowed={DURIANPAY_API_CALLS_ROLES} />,
            children: [
              { path: '/durianpay-api-calls', element: <DurianpayApiCallsPage /> },
              { path: '/durianpay-api-calls/:id', element: <DurianpayApiCallsPage /> },
            ],
          },
          { path: '/profile', element: <ProfilePage /> },
          // 404 — rute yang benar-benar tidak dikenal, DI DALAM layout (sidebar
          // tetap). Dulu `*` di luar mengalihkan diam-diam ke /login → Ringkasan.
          // Karena ia di dalam ProtectedRoute, pengunjung tanpa sesi tetap
          // diarahkan ke Login dulu (dengan `?next=`), lalu melihat 404 setelah
          // masuk. Pengalihan yang disengaja di atas (`/`, `/dashboard`, `/mint`,
          // `/burn`, `/otc`, `/kyc`, `/kyb`) adalah rute sendiri dan menang atas
          // `*` karena peringkat rute React Router.
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
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
