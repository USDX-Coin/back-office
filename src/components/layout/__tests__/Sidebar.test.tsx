import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// Redesain fase 1: lima menu utama, tiga di antaranya grup yang bisa dilipat.
// Bentuk menu per peran dikunci di `navItems.test.ts`; yang dikunci DI SINI
// adalah yang benar-benar dirender Sidebar — terutama angka antreannya, yang
// tidak boleh pernah berbohong (belum terbaca ≠ nol).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
})
afterAll(() => server.close())

const ADMIN = 'stf_1'
const STAFF = 'stf_4'

function queueCounts(data: Record<string, number>) {
  return http.get('/api/v1/queue-counts', () => HttpResponse.json({ status: 'success', metadata: null, data }))
}

function total(path: string, n: number) {
  return http.get(path, () =>
    HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 1, total: n }, data: [] }),
  )
}

function recordRequests() {
  const calls: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    calls.push(url.pathname + url.search)
  })
  return calls
}

function renderSidebar(path = '/transactions', staffId = ADMIN) {
  return renderWithProviders(<Sidebar />, { initialEntries: [path], staffId })
}

describe('Sidebar (redesain fase 1)', () => {
  describe('positive', () => {
    test('should show the original USDX lockup, not the old "U" box or a typed wordmark', () => {
      renderSidebar()
      const aside = screen.getByRole('complementary')
      expect(aside.querySelector('img[src="/image/logo-lockup.png"]')).not.toBeNull()
      expect(within(aside).queryByText('USDX')).not.toBeInTheDocument()
      expect(within(aside).queryByText(/^U$/)).not.toBeInTheDocument()
    })

    test('should render two top-level links and three collapsible groups', () => {
      renderSidebar()
      expect(screen.getByRole('link', { name: /^Transaksi/ })).toHaveAttribute('href', '/transactions')
      expect(screen.getByRole('link', { name: /^OTC/ })).toHaveAttribute('href', '/otc')
      for (const g of ['Nasabah', 'Keuangan', 'Pengaturan']) {
        expect(screen.getByRole('button', { name: new RegExp(`^${g}`) })).toHaveAttribute('aria-expanded')
      }
    })

    test('should open the group that holds the current page and mark the page', () => {
      renderSidebar('/verifikasi')
      expect(screen.getByRole('button', { name: /^Nasabah/ })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('link', { name: /^Verifikasi/ })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('button', { name: /^Pengaturan/ })).toHaveAttribute('aria-expanded', 'false')
    })

    test('should fold a group open/closed and remember the choice', async () => {
      const user = userEvent.setup()
      const { unmount } = renderSidebar()
      const btn = screen.getByRole('button', { name: /^Keuangan/ })
      expect(screen.queryByRole('link', { name: 'Rekening BNI' })).not.toBeInTheDocument()
      await user.click(btn)
      expect(btn).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('link', { name: 'Rekening BNI' })).toBeInTheDocument()
      unmount()
      renderSidebar()
      expect(screen.getByRole('button', { name: /^Keuangan/ })).toHaveAttribute('aria-expanded', 'true')
    })

    test('should show transactionsNeedsAction on Transaksi from ONE queue-counts request (not a sum of queues)', async () => {
      const calls = recordRequests()
      server.use(queueCounts({ redeemApprovalsOpen: 12, payoutFailuresOpen: 5, heldCreditsOpen: 3, approvalsOpen: 2, transactionsNeedsAction: 17 }))
      renderSidebar()
      expect(await screen.findByTestId('nav-badge-transactions')).toHaveTextContent('17')
      expect(calls.filter((c) => c.startsWith('/api/v1/queue-counts'))).toEqual(['/api/v1/queue-counts'])
      // Never the PII-decrypting lists for a count.
      expect(calls.some((c) => c.startsWith('/api/v1/payout-failures'))).toBe(false)
      expect(calls.some((c) => c.startsWith('/api/v1/redeem-approvals'))).toBe(false)
      expect(calls.some((c) => c.startsWith('/api/v1/held-credits'))).toBe(false)
    })

    test('should count OTC requests needing action (PENDING_APPROVAL + APPROVED)', async () => {
      const calls = recordRequests()
      server.use(total('/api/v1/requests', 4))
      renderSidebar()
      expect(await screen.findByTestId('nav-badge-otc')).toHaveTextContent('4')
      expect(calls).toContain('/api/v1/requests?status=PENDING_APPROVAL,APPROVED&limit=1')
    })

    test('should show the group total on a CLOSED group and the item count when open', async () => {
      const user = userEvent.setup()
      server.use(total('/api/v1/kyc', 2), total('/api/v1/kyb', 1), total('/api/v1/screening/results', 3))
      renderSidebar()
      // Nasabah closed: 2 + 1 + 3.
      expect(await screen.findByTestId('nav-badge-grup-nasabah')).toHaveTextContent('6')
      await user.click(screen.getByRole('button', { name: /^Nasabah/ }))
      expect(screen.queryByTestId('nav-badge-grup-nasabah')).not.toBeInTheDocument()
      expect(screen.getByTestId('nav-badge-verifikasi')).toHaveTextContent('3')
      expect(screen.getByTestId('nav-badge-screening')).toHaveTextContent('3')
    })
  })

  describe('negative', () => {
    test('should not render OTC — nor fire its count query — for STAFF', async () => {
      const calls = recordRequests()
      server.use(queueCounts({ redeemApprovalsOpen: 1, payoutFailuresOpen: 0, heldCreditsOpen: 0, approvalsOpen: 0, transactionsNeedsAction: 1 }))
      renderSidebar('/transactions', STAFF)
      await screen.findByTestId('nav-badge-transactions')
      expect(screen.queryByRole('link', { name: /^OTC/ })).not.toBeInTheDocument()
      expect(calls.some((c) => c.startsWith('/api/v1/requests'))).toBe(false)
    })

    test('a FAILED queue-counts reads "belum terbaca", never a made-up number or a clean queue', async () => {
      server.use(
        http.get('/api/v1/queue-counts', () =>
          HttpResponse.json({ status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } }, { status: 500 }),
        ),
      )
      renderSidebar()
      expect(await screen.findByTestId('nav-badge-transactions-galat')).toHaveAccessibleName('Jumlah antrean belum terbaca')
      expect(screen.queryByTestId('nav-badge-transactions')).not.toBeInTheDocument()
    })

    test('a zero count renders no badge at all', async () => {
      server.use(
        queueCounts({ redeemApprovalsOpen: 0, payoutFailuresOpen: 0, heldCreditsOpen: 0, approvalsOpen: 0 }),
        total('/api/v1/requests', 0),
      )
      renderSidebar()
      await waitFor(() => expect(screen.queryByTestId('nav-badge-transactions-galat')).not.toBeInTheDocument())
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByTestId('nav-badge-transactions')).not.toBeInTheDocument()
      expect(screen.queryByTestId('nav-badge-otc')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('transactionsNeedsAction absent (backend before SOT PR #50) hides the Transaksi badge', async () => {
      // Kontrak queue-counts.yaml: kunci opsional selama DRAF — "FE sembunyikan badge bila absen".
      server.use(queueCounts({ redeemApprovalsOpen: 4, payoutFailuresOpen: 3, heldCreditsOpen: 1, approvalsOpen: 0 }))
      renderSidebar()
      await new Promise((r) => setTimeout(r, 100))
      expect(screen.queryByTestId('nav-badge-transactions')).not.toBeInTheDocument()
      expect(screen.queryByTestId('nav-badge-transactions-galat')).not.toBeInTheDocument()
    })

    test('caps a large count at 99+', async () => {
      server.use(queueCounts({ redeemApprovalsOpen: 150, payoutFailuresOpen: 0, heldCreditsOpen: 0, approvalsOpen: 0, transactionsNeedsAction: 150 }))
      renderSidebar()
      expect(await screen.findByTestId('nav-badge-transactions')).toHaveTextContent('99+')
    })

    test('the nav scrolls independently of the pinned header/footer', () => {
      renderSidebar()
      expect(screen.getByRole('navigation', { name: 'Navigasi utama' })).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    })

    test('Transaksi stays highlighted on the old queue pages it now stands for', () => {
      renderSidebar('/payout-failures')
      expect(screen.getByRole('link', { name: /^Transaksi/ })).toHaveAttribute('aria-current', 'page')
    })
  })
})
