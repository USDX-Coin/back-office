import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import PayoutFailuresPage from '@/features/payout-failures/PayoutFailuresPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-662 — antrean Pencairan Bermasalah (sot/api/payout-failures.yaml).
// Handler MSW bawaan (5 order seed). Peran: stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/payout-failures', staffId = 'stf_2') {
  return renderWithProviders(<PayoutFailuresPage />, { initialEntries: [path], staffId })
}

function recordListQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/payout-failures') seen.push(url.search)
  })
  return seen
}

describe('PayoutFailuresPage @ USDX-662', () => {
  describe('positive', () => {
    test('should render the open queue oldest-first with the full account and exact amount', async () => {
      setup()
      expect(await screen.findByText('RINA SUSANTI')).toBeInTheDocument()
      const rows = screen.getAllByRole('row')
      // rows[0] = header; seed tertua = RINA SUSANTI.
      expect(within(rows[1]!).getByText('8730012245')).toBeInTheDocument()
      expect(within(rows[1]!).getByText('Rp 4.012.350,00')).toBeInTheDocument()
      expect(within(rows[1]!).getByText('Payout gagal')).toBeInTheDocument()
      // Kode mesin diterjemahkan, tidak dirender mentah.
      expect(within(rows[1]!).getByText('Ditolak provider saat diserahkan')).toBeInTheDocument()
      expect(screen.getAllByRole('row')).toHaveLength(1 + 5)
    })

    test('should send issueKind from the URL and show only that population', async () => {
      const seen = recordListQueries()
      setup('/payout-failures?issueKind=BURN_REJECTED')
      expect(await screen.findByText('DEWI KARTIKA')).toBeInTheDocument()
      expect(screen.queryByText('RINA SUSANTI')).not.toBeInTheDocument()
      expect(seen.some((q) => q.includes('issueKind=BURN_REJECTED'))).toBe(true)
    })

    test('should mark a partner order and show its partner label', async () => {
      setup()
      expect(await screen.findByText('Pintu Kripto / cust-88120')).toBeInTheDocument()
      expect(screen.getByText('Partner')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should tell STAFF the screen is read-only', async () => {
      setup('/payout-failures', 'stf_4')
      await screen.findByText('RINA SUSANTI')
      expect(screen.getByText('Hanya bisa melihat')).toBeInTheDocument()
    })

    test('should not show the read-only marker to a MANAGER', async () => {
      setup()
      await screen.findByText('RINA SUSANTI')
      expect(screen.queryByText('Hanya bisa melihat')).not.toBeInTheDocument()
    })

    test('should render an error state, not an empty queue, when the list fails', async () => {
      server.use(
        http.get('/api/v1/payout-failures', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'INTERNAL_SERVER_ERROR', message: 'x' } },
            { status: 500 },
          ),
        ),
      )
      setup()
      await waitFor(() => expect(screen.queryByText('Tidak ada pencairan bermasalah')).not.toBeInTheDocument())
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should not send an issueKind the contract does not know', async () => {
      const seen = recordListQueries()
      setup('/payout-failures?issueKind=NOPE')
      await screen.findByText('RINA SUSANTI')
      expect(seen.every((q) => !q.includes('issueKind'))).toBe(true)
    })

    test('should explain an empty queue', async () => {
      server.use(
        http.get('/api/v1/payout-failures', () =>
          HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 10, total: 0 }, data: [] }),
        ),
      )
      setup()
      expect(await screen.findByText('Tidak ada pencairan bermasalah')).toBeInTheDocument()
    })
  })
})
