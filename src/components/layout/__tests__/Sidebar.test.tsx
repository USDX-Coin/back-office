import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// USDX-50: sidebar layout = 3 sections (WORKSPACE / OTC / SETTINGS) per
// sot/phase-1.md § Sidebar L452-467 and Linear AC #1.

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Sidebar @ USDX-50', () => {
  describe('layout (admin)', () => {
    test('renders 4 section headers: Workspace / OTC / Settings / Troubleshooting', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.getByText(/workspace/i)).toBeInTheDocument()
      expect(screen.getByText(/^otc$/i)).toBeInTheDocument()
      expect(screen.getByText(/settings/i)).toBeInTheDocument()
      // USDX-87: Manual Sync lives in its own Troubleshooting section.
      expect(screen.getByText(/troubleshooting/i)).toBeInTheDocument()
    })

    test('renders all admin nav links', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      // WORKSPACE
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^users$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^staff$/i })).toBeInTheDocument()
      // OTC
      expect(screen.getByRole('link', { name: /^mint$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^burn$/i })).toBeInTheDocument()
      // SETTINGS
      expect(screen.getByRole('link', { name: /^rate$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^threshold$/i })).toBeInTheDocument()
      // USDX-485 — kontak on-call insiden uang (Settings, ADMIN saja).
      expect(screen.getByRole('link', { name: /^on-call$/i })).toBeInTheDocument()
      // TROUBLESHOOTING (USDX-87)
      expect(screen.getByRole('link', { name: /manual sync/i })).toBeInTheDocument()
    })
  })

  describe('regression guards (Linear AC: removed entries)', () => {
    test('does not render Profile (navbar dropdown only)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.queryByRole('link', { name: /profile/i })).not.toBeInTheDocument()
    })

    test('does not render removed entries (Redeem, Mint request, Requests, Notifications, Report)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.queryByRole('link', { name: /^redeem$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /mint request/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^requests$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^notifications$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^report$/i })).not.toBeInTheDocument()
    })
  })

  describe('role gating', () => {
    test('Staff link hidden for non-admin (Flag-A: hidden per Linear)', () => {
      // stf_4 = Sarah King (STAFF role) per data.ts seed factory.
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4',
      })
      expect(screen.queryByRole('link', { name: /^staff$/i })).not.toBeInTheDocument()
    })

    test('SETTINGS section hidden for STAFF role (Flag-B)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // STAFF role
      })
      expect(screen.queryByRole('link', { name: /^rate$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^threshold$/i })).not.toBeInTheDocument()
    })

    // USDX-485 (audit P1-18): On-Call di-gate di level ITEM, lebih ketat dari
    // section-nya. Daftar itu memuat nomor telepon (PII → ADMIN saja per
    // conventions.md § Audit Akses PII) dan menentukan siapa yang boleh menarik
    // rem darurat payout — DEVELOPER melihat Rate/Fee/Threshold, tapi tidak ini.
    test('On-Call link hidden for DEVELOPER even though the SETTINGS section is visible (USDX-485)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_3', // Marcus Aurelius DEVELOPER
      })
      expect(screen.getByRole('link', { name: /^threshold$/i })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^on-call$/i })).not.toBeInTheDocument()
    })

    test('On-Call link hidden for STAFF (USDX-485)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // STAFF role
      })
      expect(screen.queryByRole('link', { name: /^on-call$/i })).not.toBeInTheDocument()
    })

    test('SETTINGS section visible for DEVELOPER role (Flag-B: SoT § Backoffice Role System grants System Config)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_3', // Marcus Aurelius DEVELOPER
      })
      expect(screen.getByRole('link', { name: /^rate$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^threshold$/i })).toBeInTheDocument()
      // Staff entry stays hidden (admin only) even for DEVELOPER per Flag-A.
      expect(screen.queryByRole('link', { name: /^staff$/i })).not.toBeInTheDocument()
    })

    // USDX-87: Manual Sync is an emergency recovery surface — every role
    // (incl. STAFF who has no Settings access) must see it.
    test('Troubleshooting > Manual Sync visible to STAFF role', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // STAFF role
      })
      expect(screen.getByRole('link', { name: /manual sync/i })).toBeInTheDocument()
      expect(screen.getByText(/troubleshooting/i)).toBeInTheDocument()
    })
  })

  describe('badge counter (sot/phase-1.md § Sidebar)', () => {
    test('shows (N) badge on Mint when there are PENDING_APPROVAL requests', async () => {
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          const url = new URL(request.url)
          const type = url.searchParams.get('type')
          const status = url.searchParams.get('status')
          if (type === 'mint' && status === 'PENDING_APPROVAL') {
            return HttpResponse.json({
              status: 'success',
              metadata: { page: 1, limit: 1, total: 7 },
              data: [],
            })
          }
          return HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 1, total: 0 },
            data: [],
          })
        })
      )
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const badge = await screen.findByTestId('nav-badge-mint')
      expect(badge).toHaveTextContent('7')
    })

    test('hides badge entirely when count is 0', async () => {
      server.use(
        http.get('/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 1, total: 0 },
            data: [],
          })
        )
      )
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      // Wait for the query to resolve, then assert no badge testid is present.
      // queryByTestId is sufficient because the badge node only renders when
      // the count is > 0 (per Linear AC: hide angka, label saja saat 0).
      expect(screen.queryByTestId('nav-badge-mint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('nav-badge-burn')).not.toBeInTheDocument()
    })
  })

  // USDX-78 — STAFF can't access /mint /burn lists (sot/phase-1.md L34 +
  // L653-655). Sidebar redirects Mint/Burn straight to the form and hides
  // the (N) badge so STAFF doesn't see a counter they can't act on.
  describe('USDX-78 — STAFF sidebar', () => {
    test('STAFF Mint link targets /mint/new instead of /mint', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // Sarah King (STAFF)
      })
      const mintLink = screen.getByRole('link', { name: /^mint$/i })
      expect(mintLink).toHaveAttribute('href', '/mint/new')
    })

    test('STAFF Burn link targets /burn/new instead of /burn', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4',
      })
      const burnLink = screen.getByRole('link', { name: /^burn$/i })
      expect(burnLink).toHaveAttribute('href', '/burn/new')
    })

    test('STAFF never sees the Mint/Burn (N) badge', async () => {
      // Even if a stale handler returned a count, the Sidebar disables the
      // count query for STAFF and never renders a badge.
      server.use(
        http.get('/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 1, total: 99 },
            data: [],
          })
        )
      )
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4',
      })
      expect(screen.queryByTestId('nav-badge-mint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('nav-badge-burn')).not.toBeInTheDocument()
    })
  })

  // Sidebar outgrew the viewport once the Reporting + Troubleshooting sections
  // landed, and MainLayout clips overflow (h-screen overflow-hidden) — so the
  // nav itself must scroll. jsdom performs no layout, so guard the classes
  // that make it scrollable (min-h-0 lets the flex child shrink below its
  // content height; without it overflow-y-auto never engages).
  describe('scrollable nav (sidebar taller than viewport)', () => {
    test('nav scrolls independently of the pinned header/footer', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    })
  })

  // USDX-154 — COMPLIANCE group + KYC Review (N) badge. Visible to every role
  // (week1.md § Authorization Guard: list is Admin/Manager/Staff/Developer);
  // unlike Mint/Burn the badge also renders for STAFF.
  describe('USDX-154 — COMPLIANCE / KYC Review', () => {
    function kycCount(total: number) {
      return http.get('/api/v1/kyc', () =>
        HttpResponse.json({
          status: 'success',
          metadata: { page: 1, limit: 1, total },
          data: [],
        })
      )
    }

    test('renders Compliance section with a KYC Review link to /kyc (admin)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.getByText(/compliance/i)).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /kyc review/i })
      expect(link).toHaveAttribute('href', '/kyc')
    })

    test('shows (N) badge with the PENDING submission count', async () => {
      server.use(kycCount(5))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const badge = await screen.findByTestId('nav-badge-kyc')
      expect(badge).toHaveTextContent('5')
    })

    test('hides the badge when the PENDING count is 0', async () => {
      server.use(kycCount(0))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      // Link renders; badge node only mounts when count > 0.
      await screen.findByRole('link', { name: /kyc review/i })
      expect(screen.queryByTestId('nav-badge-kyc')).not.toBeInTheDocument()
    })

    test('STAFF sees KYC Review with the badge (list is staff-accessible, unlike /mint)', async () => {
      server.use(kycCount(3))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // Sarah King (STAFF)
      })
      const link = screen.getByRole('link', { name: /kyc review/i })
      expect(link).toHaveAttribute('href', '/kyc')
      const badge = await screen.findByTestId('nav-badge-kyc')
      expect(badge).toHaveTextContent('3')
    })

    test('DEVELOPER sees KYC Review (view-only role still gets the list menu)', async () => {
      server.use(kycCount(2))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_3', // Marcus Aurelius (DEVELOPER)
      })
      expect(screen.getByRole('link', { name: /kyc review/i })).toBeInTheDocument()
      const badge = await screen.findByTestId('nav-badge-kyc')
      expect(badge).toHaveTextContent('2')
    })
  })
})
