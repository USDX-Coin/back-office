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
    // § 4 P2-1 — struktur menu 8 section → 5, berbahasa Indonesia. Drawer
    // mobile memakai `NAV_SECTIONS` yang sama dengan Sidebar, jadi ia ikut
    // berubah; tes ini diubah supaya tetap membuktikan keduanya sinkron.
    test('renders 5 section headers berbahasa Indonesia', () => {
      renderOpen()
      expect(screen.getByText(/^pekerjaan hari ini$/i)).toBeInTheDocument()
      expect(screen.getByText(/^meja otc$/i)).toBeInTheDocument()
      expect(screen.getByText(/^keuangan$/i)).toBeInTheDocument()
      // TEPAT DUA: judul section + satu entri bernama sama. Batas bawah `>= 2`
      // yang dulu di sini juga hijau untuk laci yang merender menunya dua kali.
      expect(screen.getAllByText(/^nasabah$/i)).toHaveLength(2)
      expect(screen.getAllByText(/^pengaturan$/i)).toHaveLength(2)
      expect(screen.queryByText(/troubleshooting/i)).not.toBeInTheDocument()
    })

    test('renders every admin nav link', () => {
      renderOpen()
      for (const name of [
        /^beranda$/i,
        /^transaksi nasabah$/i,
        /^nasabah$/i,
        /^pengguna internal$/i,
        /^mint otc$/i,
        /^burn otc$/i,
        /^pengaturan$/i,
        /^mode mint$/i,
        /^perbaiki status nyangkut$/i,
      ]) {
        expect(screen.getByRole('link', { name })).toBeInTheDocument()
      }
    })

    test('renders the logout action', () => {
      renderOpen()
      expect(screen.getByRole('button', { name: /keluar/i })).toBeInTheDocument()
    })
  })

  describe('interaction', () => {
    test('clicking a nav link closes the drawer', () => {
      const { onOpenChange } = renderOpen()
      fireEvent.click(screen.getByRole('link', { name: /^mint otc$/i }))
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
        expect(await within(payoutFailures).findByLabelText('6 menunggu diproses')).toBeInTheDocument()
        expect(await within(redeemApprovals).findByLabelText('3 menunggu diproses')).toBeInTheDocument()
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
        expect(await within(redeemApprovals).findByLabelText('2 menunggu diproses')).toBeInTheDocument()
        const payoutFailures = screen.getByRole('link', { name: /pencairan bermasalah/i })
        expect(within(payoutFailures).queryByLabelText(/pending/)).not.toBeInTheDocument()
      })
    })
  })

  // USDX-78 — STAFF on mobile mirrors the desktop sidebar (sot/phase-1.md
  // L653-655): Mint/Burn target the form directly, no PENDING_APPROVAL badge.
  describe('USDX-78 — STAFF nav', () => {
    test('STAFF Mint OTC and Burn OTC target the form routes, no badge', () => {
      renderWithProviders(<MobileNavDrawer open onOpenChange={vi.fn()} />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // Sarah King (STAFF)
      })
      expect(screen.getByRole('link', { name: /^mint otc$/i })).toHaveAttribute(
        'href',
        '/mint/new'
      )
      expect(screen.getByRole('link', { name: /^burn otc$/i })).toHaveAttribute(
        'href',
        '/burn/new'
      )
    })
  })
})
