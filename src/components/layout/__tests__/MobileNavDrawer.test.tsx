import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import MobileNavDrawer from '@/components/layout/MobileNavDrawer'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// USDX-27: the mobile bottom nav + "More" sheet were replaced by a single
// left-side drawer (opened by the Navbar hamburger) that mirrors the desktop
// Sidebar — same sections, same role gating.

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderOpen(onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...renderWithProviders(<MobileNavDrawer open onOpenChange={onOpenChange} />, {
      initialEntries: ['/dashboard'],
      authenticated: true,
    }),
  }
}

describe('MobileNavDrawer @ USDX-27', () => {
  describe('layout (admin)', () => {
    test('renders 4 section headers: Workspace / OTC / Settings / Troubleshooting', () => {
      renderOpen()
      expect(screen.getByText(/workspace/i)).toBeInTheDocument()
      expect(screen.getByText(/^otc$/i)).toBeInTheDocument()
      expect(screen.getByText(/settings/i)).toBeInTheDocument()
      // USDX-87: Manual Sync lives in its own Troubleshooting section.
      expect(screen.getByText(/troubleshooting/i)).toBeInTheDocument()
    })

    test('renders every admin nav link', () => {
      renderOpen()
      for (const name of [
        /dashboard/i,
        /^users$/i,
        /^staff$/i,
        /^mint$/i,
        /^burn$/i,
        /^rate$/i,
        /^threshold$/i,
        /manual sync/i,
      ]) {
        expect(screen.getByRole('link', { name })).toBeInTheDocument()
      }
    })

    test('renders the logout action', () => {
      renderOpen()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })
  })

  describe('interaction', () => {
    test('clicking a nav link closes the drawer', () => {
      const { onOpenChange } = renderOpen()
      fireEvent.click(screen.getByRole('link', { name: /^mint$/i }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('regression guards', () => {
    test('does not render removed entries (Requests / OTC splash / Notifications)', () => {
      renderOpen()
      const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
      expect(hrefs).not.toContain('/requests')
      expect(hrefs).not.toContain('/otc')
      expect(hrefs).not.toContain('/notifications')
    })
  })

  // USDX-678 — badge Pencairan Bermasalah & Persetujuan Pencairan dari queue-counts,
  // sama dengan Sidebar; tidak ada tarikan list `take=1` yang menulis audit PII palsu.
  describe('USDX-678 — badge antrean dari queue-counts', () => {
    afterEach(() => server.events.removeAllListeners())

    describe('positive', () => {
      test('shows both queue badges from GET /api/v1/queue-counts', async () => {
        server.use(
          http.get('/api/v1/queue-counts', () =>
            HttpResponse.json({
              status: 'success',
              metadata: null,
              data: { payoutFailuresOpen: 6, redeemApprovalsOpen: 3 },
            })
          )
        )
        renderOpen()
        const payoutFailures = screen.getByRole('link', { name: /pencairan bermasalah/i })
        const redeemApprovals = screen.getByRole('link', { name: /persetujuan pencairan/i })
        expect(await within(payoutFailures).findByLabelText('6 pending')).toBeInTheDocument()
        expect(await within(redeemApprovals).findByLabelText('3 pending')).toBeInTheDocument()
      })
    })

    describe('negative', () => {
      test('never pulls the PII-decrypting lists for a count', async () => {
        const calls: string[] = []
        server.events.on('request:start', ({ request }) => {
          calls.push(new URL(request.url).pathname)
        })
        renderOpen()
        await waitFor(() => expect(calls).toContain('/api/v1/queue-counts'))
        expect(calls).not.toContain('/api/v1/payout-failures')
        expect(calls).not.toContain('/api/v1/redeem-approvals')
      })
    })

    describe('edge cases', () => {
      test('a zero count renders no badge while the other queue still shows its count', async () => {
        server.use(
          http.get('/api/v1/queue-counts', () =>
            HttpResponse.json({
              status: 'success',
              metadata: null,
              data: { payoutFailuresOpen: 0, redeemApprovalsOpen: 2 },
            })
          )
        )
        renderOpen()
        const redeemApprovals = screen.getByRole('link', { name: /persetujuan pencairan/i })
        expect(await within(redeemApprovals).findByLabelText('2 pending')).toBeInTheDocument()
        const payoutFailures = screen.getByRole('link', { name: /pencairan bermasalah/i })
        expect(within(payoutFailures).queryByLabelText(/pending/)).not.toBeInTheDocument()
      })
    })
  })

  // USDX-78 — STAFF on mobile mirrors the desktop sidebar (sot/phase-1.md
  // L653-655): Mint/Burn target the form directly, no PENDING_APPROVAL badge.
  describe('USDX-78 — STAFF nav', () => {
    test('STAFF Mint and Burn target the form routes, no badge', () => {
      renderWithProviders(<MobileNavDrawer open onOpenChange={vi.fn()} />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // Sarah King (STAFF)
      })
      expect(screen.getByRole('link', { name: /^mint$/i })).toHaveAttribute(
        'href',
        '/mint/new'
      )
      expect(screen.getByRole('link', { name: /^burn$/i })).toHaveAttribute(
        'href',
        '/burn/new'
      )
    })
  })
})
