import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { findStaffByEmail, resetMockData } from '@/mocks/handlers'
import { renderWithProviders } from '@/test/test-utils'
import OverviewPage from '../OverviewPage'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function recordRequests() {
  const calls: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    calls.push(url.pathname + url.search)
  })
  return calls
}

const STATS = {
  totalSupply: '1000000.00',
  totalMinted: '1200000.00',
  totalBurned: '200000.00',
  pendingRequests: 2,
  requestsByStatus: { PENDING_APPROVAL: 2, APPROVED: 1, EXECUTED: 4, REJECTED: 1 },
  safeBalances: { staff: '750000.00', manager: '5250000.00' },
  currentRate: '16250.00',
}

function stubStats() {
  server.use(http.get('/api/v1/dashboard/stats', () => HttpResponse.json({ status: 'success', metadata: null, data: STATS })))
}

function renderPage(email = 'demo@usdx.io') {
  return renderWithProviders(<OverviewPage />, {
    initialEntries: ['/ringkasan'],
    staffId: findStaffByEmail(email)!.id,
  })
}

describe('OverviewPage (Ringkasan)', () => {
  describe('positive', () => {
    test('shows token supply, Safe balances and rate from dashboard/stats', async () => {
      stubStats()
      renderPage()
      const token = await screen.findByTestId('ringkasan-token')
      expect(await within(token).findByTestId('ringkasan-pasokan')).toHaveTextContent('1.000.000,00USDX')
      expect(within(token).getByText('750.000,00 USDX')).toBeInTheDocument()
      expect(within(token).getByText('5.250.000,00 USDX')).toBeInTheDocument()
      expect(within(token).getByText('Rp 16.250')).toBeInTheDocument()
      expect(within(token).getByText(/on-chain, Polygon/)).toBeInTheDocument()
    })

    test('labels the OTC figures as OTC-only', async () => {
      stubStats()
      renderPage()
      const otc = await screen.findByTestId('ringkasan-otc')
      expect(within(otc).getByText(/khusus permintaan OTC/i)).toBeInTheDocument()
      expect(await within(otc).findByText('1.200.000,00 USDX')).toBeInTheDocument()
      expect(within(otc).getByTestId('ringkasan-otc-EXECUTED')).toHaveTextContent('4')
    })

    test('links "Perlu tindakan" to the Transaksi default tab with the queue count', async () => {
      server.use(
        http.get('/api/v1/queue-counts', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { payoutFailuresOpen: 2, redeemApprovalsOpen: 1, heldCreditsOpen: 3, approvalsOpen: 0, transactionsNeedsAction: 6 },
          }),
        ),
      )
      renderPage()
      const card = await screen.findByTestId('ringkasan-perlu-tindakan')
      expect(await within(card).findByTestId('ringkasan-transaksi-perlu-tindakan')).toHaveTextContent('6')
      expect(within(card).getByRole('link', { name: /buka transaksi/i })).toHaveAttribute('href', '/transactions')
    })

    test('pulls BNI balances ONLY when "Cek saldo" is pressed, then shows the pull time', async () => {
      const user = userEvent.setup()
      const calls = recordRequests()
      renderPage()
      const card = await screen.findByTestId('ringkasan-bni')
      await within(card).findAllByText('Belum dicek')
      await new Promise((r) => setTimeout(r, 50))
      expect(calls.some((c) => c.startsWith('/api/v1/bni-accounts/balances'))).toBe(false)

      await user.click(within(card).getByTestId('ringkasan-cek-saldo'))
      expect(await within(card).findByTestId('ringkasan-bni-ditarik')).toHaveTextContent(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}:\d{2}$/)
      expect(within(card).getByText(/Ditarik \(WIB\)/)).toBeInTheDocument()
      expect(calls.filter((c) => c.startsWith('/api/v1/bni-accounts/balances'))).toHaveLength(1)
      expect(within(card).getByRole('button', { name: /cek ulang/i })).toBeInTheDocument()
    })

    test('shows the reserve for ADMIN with the manual-entry caveat', async () => {
      renderPage()
      const card = await screen.findByTestId('ringkasan-cadangan')
      expect(within(card).getByText('Dicatat manual oleh admin, bukan saldo bank live.')).toBeInTheDocument()
      expect(await within(card).findByTestId('ringkasan-cadangan-saldo')).toHaveTextContent(/,\d{2}USD$/)
    })
  })

  describe('negative', () => {
    test('STAFF does not see the reserve and never calls the ledger', async () => {
      const calls = recordRequests()
      stubStats()
      renderPage('sking@usdx.io')
      await screen.findByTestId('ringkasan-token')
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByTestId('ringkasan-cadangan')).not.toBeInTheDocument()
      expect(calls.some((c) => c.startsWith('/api/v1/transparency/ledger'))).toBe(false)
    })

    test('the DurianPay gateway balance is "Belum tersedia" — no number at all', async () => {
      renderPage()
      const card = await screen.findByTestId('ringkasan-durianpay')
      expect(within(card).getByText('Belum tersedia')).toBeInTheDocument()
      expect(card.textContent).not.toMatch(/\d/)
    })
  })

  describe('edge cases', () => {
    test('a failing dashboard/stats offers a retry instead of zeros', async () => {
      server.use(
        http.get('/api/v1/dashboard/stats', () =>
          HttpResponse.json({ status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } }, { status: 500 }),
        ),
      )
      renderPage()
      const token = await screen.findByTestId('ringkasan-token')
      await waitFor(() => expect(within(token).getByText(/gagal dimuat/i)).toBeInTheDocument())
      expect(within(token).getByRole('button', { name: /coba lagi/i })).toBeInTheDocument()
    })
  })
})
