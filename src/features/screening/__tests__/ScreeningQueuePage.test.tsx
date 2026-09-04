import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import ScreeningQueuePage from '@/features/screening/ScreeningQueuePage'
import { renderWithProviders } from '@/test/test-utils'
import type { ScreeningResultItem } from '@/lib/types'

// USDX-588 — antrean temuan screening.
//
// `/api/v1/screening/*` dilayani backend SUNGGUHAN dan tidak punya handler MSW
// sama sekali, jadi tiap tes di sini menyetel sendiri endpoint yang diujinya.
// Bentuk barisnya disalin bidang demi bidang dari
// `backend/src/modules/screening/screening.types.ts § ScreeningResultItem` —
// yang paling menentukan: TIDAK ADA nama nasabah di dalamnya.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const row = (overrides: Partial<ScreeningResultItem> = {}): ScreeningResultItem => ({
  id: 'scr_1',
  subjectType: 'KYC',
  subjectId: 'kyc_1',
  outcome: 'POTENTIAL_MATCH',
  score: 0.9231,
  matchedName: 'BUDI SANTOSO',
  matchCount: 1,
  trigger: 'KYC_SUBMIT',
  listId: 'lst_1',
  listType: 'DTTOT',
  listPublishedAt: '2026-07-01',
  decision: null,
  createdAt: '2026-08-30T04:00:00Z',
  ...overrides,
})

function okList(rows: ScreeningResultItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 10, total: rows.length },
    data: rows,
  })
}

function TestApp() {
  return (
    <Routes>
      <Route path="/screening" element={<ScreeningQueuePage />} />
      <Route path="/screening/:id" element={<ScreeningQueuePage />} />
      <Route path="/screening/lists" element={<div>Halaman daftar sanksi</div>} />
    </Routes>
  )
}

function setup(initialEntries: string[] = ['/screening'], staffId?: string) {
  return renderWithProviders(<TestApp />, {
    initialEntries,
    authenticated: true,
    staffId,
  })
}

describe('ScreeningQueuePage @ USDX-588', () => {
  describe('positive', () => {
    test('should render a finding with its score, matched name and list vintage', async () => {
      server.use(http.get('/api/v1/screening/results', () => okList([row()])))
      setup()

      expect(await screen.findByText('BUDI SANTOSO')).toBeInTheDocument()
      expect(screen.getByText('92.3%')).toBeInTheDocument()
      // "Lolos pakai daftar terbitan tanggal berapa" adalah pertanyaan pertama
      // seorang pemeriksa — jawabannya harus ada di antrean, bukan hanya di detail.
      expect(screen.getByText(/terbit 2026-07-01/)).toBeInTheDocument()
    })

    test('should default the queue to open=true — the work, not the whole audit trail', async () => {
      const searches: string[] = []
      server.use(
        http.get('/api/v1/screening/results', ({ request }) => {
          searches.push(new URL(request.url).search)
          return okList([row()])
        }),
      )
      setup()
      await screen.findByText('BUDI SANTOSO')
      expect(searches[0]).toContain('open=true')
    })

    test('should mark an undecided finding as awaiting a decision', async () => {
      server.use(http.get('/api/v1/screening/results', () => okList([row()])))
      setup()
      expect(await screen.findByText('Menunggu keputusan')).toBeInTheDocument()
    })

    test('should show a recorded decision with the deciding officer', async () => {
      // `open=true` menyaring keputusan yang bukan CLEARED, jadi sebuah temuan
      // yang sudah diputus CONFIRMED_MATCH TETAP di antrean — subjeknya masih
      // tertahan. Antrean harus memisahkan "belum disentuh" dari "sudah diputus
      // dan masih menahan", kalau tidak petugas mengerjakan ulang berkas yang
      // sudah selesai dianalisis.
      server.use(
        http.get('/api/v1/screening/results', () =>
          okList([
            row({
              decision: {
                id: 'dec_1',
                outcome: 'CONFIRMED_MATCH',
                decidedBy: 'stf_1',
                decidedByName: 'Linda Chen',
                reason: 'Tanggal lahir dan kebangsaan sama persis',
                createdAt: '2026-08-31T02:00:00Z',
              },
            }),
          ]),
        ),
      )
      setup()
      expect(await screen.findByText('Linda Chen')).toBeInTheDocument()
      expect(screen.getByText('Cocok dikonfirmasi')).toBeInTheDocument()
      expect(screen.queryByText('Menunggu keputusan')).not.toBeInTheDocument()
    })

    test('should warn when more than one list entry passed the threshold', async () => {
      // Entri yang ditampilkan hanya kecocokan TERBAIK. Melepas temuan tanpa
      // tahu ada empat entri lain yang juga cocok adalah melepas atas dasar
      // sebagian bukti.
      server.use(http.get('/api/v1/screening/results', () => okList([row({ matchCount: 5 })])))
      setup()
      expect(await screen.findByText(/\+4 entri lain juga cocok/)).toBeInTheDocument()
    })

    test('should let a MANAGER reach the sanction-list page', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/screening/results', () => okList([row()])))
      setup(['/screening'], 'stf_2') // Linda Chen, MANAGER
      await screen.findByText('BUDI SANTOSO')

      await user.click(screen.getByRole('button', { name: /daftar sanksi/i }))
      expect(await screen.findByText('Halaman daftar sanksi')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should hide the sanction-list action from STAFF — import is MANAGER/ADMIN', async () => {
      server.use(http.get('/api/v1/screening/results', () => okList([row()])))
      setup(['/screening'], 'stf_4') // Sarah King, STAFF
      await screen.findByText('BUDI SANTOSO')
      expect(screen.queryByRole('button', { name: /daftar sanksi/i })).not.toBeInTheDocument()
    })

    test('should offer a retry when the queue fails to load', async () => {
      server.use(
        http.get('/api/v1/screening/results', () =>
          HttpResponse.json(
            { status: 'error', error: { code: 'INTERNAL', message: 'boom' } },
            { status: 500 },
          ),
        ),
      )
      setup()
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should render an em dash for a null score rather than 0%', async () => {
      // Skor `null` hanya terjadi pada LIST_UNAVAILABLE. "0%" akan terbaca
      // sebagai "sudah dibandingkan dan sangat berbeda" — kebalikan artinya.
      server.use(
        http.get('/api/v1/screening/results', () =>
          okList([
            row({
              outcome: 'LIST_UNAVAILABLE',
              score: null,
              matchedName: null,
              matchCount: null,
              listId: null,
              listType: null,
              listPublishedAt: null,
            }),
          ]),
        ),
      )
      setup()
      expect(await screen.findByText('Daftar tidak tersedia')).toBeInTheDocument()
      expect(screen.queryByText('0.0%')).not.toBeInTheDocument()
    })

    test('should drop the open filter when the operator asks for the whole trail', async () => {
      const searches: string[] = []
      server.use(
        http.get('/api/v1/screening/results', ({ request }) => {
          searches.push(new URL(request.url).search)
          return okList([row({ outcome: 'NO_MATCH', score: 0.2, matchedName: null })])
        }),
      )
      setup(['/screening?queue=all'])
      await waitFor(() => expect(searches.length).toBeGreaterThan(0))
      expect(searches[0]).not.toContain('open=')
    })
  })
})
