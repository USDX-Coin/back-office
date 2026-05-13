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
})
