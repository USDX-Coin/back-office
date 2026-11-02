import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { delay, http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import MintSwapIssuesPage from '@/features/mint-swaps/MintSwapIssuesPage'
import { renderWithProviders } from '@/test/test-utils'

// D29 / USDX-792 — antrean "Swap Bermasalah" (sot/api/mint-swaps.yaml, § 21.6).
// Seed MSW (`createMockMintSwaps`): 4 swap NEEDS_ACTION, terlama dulu —
//   1 Budi   RETRY_EXHAUSTED, percobaan terakhir FAILED  → RETRY · SETTLED_MANUAL · CLOSED
//   2 Siti   BANK_REJECTED,   FAILED                     → ketiganya
//   3 Andi   RESULT_PENDING,  UNKNOWN (PENDING di bank)  → TANPA aksi
//   4 Dewi   RESULT_PENDING,  UNKNOWN NEEDS_REVIEW       → SETTLED_MANUAL saja
// Peran: stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

const BUDI = '019f5d01-0792-7c31-9b2d-000000000001'
const ANDI = '019f5d01-0792-7c31-9b2d-000000000003'
const DEWI = '019f5d01-0792-7c31-9b2d-000000000004'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/swap-bermasalah', staffId = 'stf_2') {
  return renderWithProviders(
    <Routes>
      <Route path="/swap-bermasalah" element={<MintSwapIssuesPage />} />
      <Route path="/swap-bermasalah/:id" element={<MintSwapIssuesPage />} />
    </Routes>,
    { initialEntries: [path], staffId },
  )
}

const modal = () => screen.findByTestId('mint-swap-modal')

describe('MintSwapIssuesPage @ USDX-792', () => {
  describe('positive', () => {
    test('should list NEEDS_ACTION swaps oldest-first with the reason in plain words', async () => {
      const { container } = setup()
      expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(4)
      expect(within(rows[0]!).getByText(/Sudah 30 menit dan swap belum berhasil/)).toBeInTheDocument()
      expect(within(rows[1]!).getByText(/BNI menolak swap ini/)).toBeInTheDocument()
      // Status dibedakan TEKS, bukan hanya warna.
      expect(within(rows[0]!).getByText('Perlu tindakan')).toBeInTheDocument()
    })

    test('should open the row with the keyboard and render ONLY allowedActions', async () => {
      const user = userEvent.setup()
      setup()
      const row = await screen.findByRole('button', { name: /Swap bermasalah Budi Santoso/ })
      row.focus()
      await user.keyboard('{Enter}')
      const m = await modal()
      expect(await within(m).findByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
      expect(within(m).getByRole('button', { name: 'Sudah ditukar manual' })).toBeInTheDocument()
      expect(within(m).getByRole('button', { name: 'Tutup swap' })).toBeInTheDocument()
      // Kalimat di atas tombol menjelaskan kenapa tersedia.
      expect(within(m).getByTestId('mint-swap-action-reasons')).toHaveTextContent('percobaan terakhir (ke-3) ditolak')
    })

    test('should render a timeline in time order where every row names its source', async () => {
      setup(`/swap-bermasalah/${BUDI}`)
      const m = await modal()
      const tl = await within(m).findByTestId('mint-swap-timeline')
      const items = [...tl.querySelectorAll('li')]
      expect(items.length).toBeGreaterThan(5)
      for (const li of items) expect(li.textContent).toMatch(/Sumber: /)
      expect(items[0]!.getAttribute('data-kind')).toBe('ORDER_CREATED')
      expect(within(m).getByTestId('mint-swap-profit')).toHaveTextContent('Menunggu pencairan PG')
    })

    test('RETRY should remove the row from the queue and decrement the badge source', async () => {
      const user = userEvent.setup()
      setup(`/swap-bermasalah/${BUDI}`)
      const m = await modal()
      await user.click(await within(m).findByRole('button', { name: 'Coba lagi' }))
      const dialog = await screen.findByRole('dialog', { name: 'Coba lagi swap ini?' })
      expect(within(dialog).getByTestId('resolve-impact')).toHaveTextContent('order dilanjutkan ke mint 1.000 USDX')
      const submit = within(dialog).getByRole('button', { name: 'Coba lagi' })
      expect(submit).toBeDisabled()
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'Prefunding sudah diisi treasury')
      await user.click(submit)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Coba lagi swap ini?' })).not.toBeInTheDocument())
      await waitFor(() => expect(screen.queryByRole('button', { name: /Swap bermasalah Budi Santoso/ })).not.toBeInTheDocument())
      const counts = (await (await fetch('/api/v1/queue-counts')).json()) as { data: { mintSwapIssuesOpen: number } }
      expect(counts.data.mintSwapIssuesOpen).toBe(3)
    })

    test('SETTLED_MANUAL should send ref + dollars, answer 202 and stay in the queue as "menunggu persetujuan"', async () => {
      const user = userEvent.setup()
      let sent: unknown = null
      server.events.on('request:start', async ({ request }) => {
        if (request.url.endsWith('/resolve')) sent = await request.clone().json()
      })
      setup(`/swap-bermasalah/${DEWI}`)
      const m = await modal()
      // UNKNOWN + NEEDS_REVIEW → hanya SETTLED_MANUAL.
      await within(m).findByRole('button', { name: 'Sudah ditukar manual' })
      expect(within(m).queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument()
      expect(within(m).queryByRole('button', { name: 'Tutup swap' })).not.toBeInTheDocument()
      await user.click(within(m).getByRole('button', { name: 'Sudah ditukar manual' }))
      const dialog = await screen.findByRole('dialog', { name: 'Nyatakan sudah ditukar manual?' })
      await user.type(within(dialog).getByLabelText(/Nomor referensi BNI/), 'FX-MANUAL-01')
      await user.type(within(dialog).getByLabelText(/Dolar yang diterima/), '1000.5')
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'Treasury menukar di BNIdirect')
      await user.click(within(dialog).getByRole('button', { name: 'Kirim usulan' }))
      await waitFor(() => expect(within(m).getByTestId('mint-swap-pending-approval')).toHaveTextContent('Menunggu persetujuan orang kedua'))
      expect(sent).toEqual({ action: 'SETTLED_MANUAL', reason: 'Treasury menukar di BNIdirect', externalRef: 'FX-MANUAL-01', creditedUsd: '1000.50' })
      // Tidak keluar sebelum disetujui (baris di balik modal = aria-hidden, jadi dibaca dari DOM).
      await waitFor(() =>
        expect(document.querySelector(`[data-row-id="${DEWI}"]`)?.getAttribute('aria-label')).toMatch(/menunggu persetujuan/),
      )
      expect(within(m).queryByRole('button', { name: 'Sudah ditukar manual' })).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should hide every action while pending proposals cannot be read, then offer them after reload', async () => {
      const user = userEvent.setup()
      let fail = true
      server.use(
        http.get('/api/v1/approvals', () =>
          fail ? HttpResponse.json({ status: 'error', error: { code: 'INTERNAL' } }, { status: 500 }) : undefined,
        ),
      )
      setup(`/swap-bermasalah/${BUDI}`)
      const m = await modal()
      const notice = await within(m).findByTestId('mint-swap-pending-unknown')
      expect(notice).toHaveTextContent('tidak bisa dimuat')
      // RETRY / CLOSED di atas usulan manual yang mungkin menunggu = dolar bisa dibeli dua kali.
      expect(within(m).queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument()
      expect(within(m).queryByRole('button', { name: 'Tutup swap' })).not.toBeInTheDocument()
      expect(within(m).queryByRole('button', { name: 'Sudah ditukar manual' })).not.toBeInTheDocument()
      fail = false
      await user.click(within(notice).getByRole('button', { name: 'Muat ulang' }))
      expect(await within(m).findByRole('button', { name: 'Tutup swap' })).toBeInTheDocument()
      expect(within(m).queryByTestId('mint-swap-pending-unknown')).not.toBeInTheDocument()
    })

    test('should send ONE resolve request when the submit button is pressed twice', async () => {
      const user = userEvent.setup()
      let calls = 0
      server.events.on('request:start', ({ request }) => {
        if (request.method === 'POST' && request.url.endsWith('/resolve')) calls++
      })
      // Jawaban server ditahan supaya klik kedua jatuh SAAT kiriman pertama masih berjalan.
      server.use(
        http.post('/api/v1/mint-swaps/:id/resolve', async () => {
          await delay(300)
          return undefined
        }),
      )
      setup(`/swap-bermasalah/${BUDI}`)
      const m = await modal()
      await user.click(await within(m).findByRole('button', { name: 'Coba lagi' }))
      const dialog = await screen.findByRole('dialog', { name: 'Coba lagi swap ini?' })
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'Prefunding sudah diisi treasury')
      const submit = within(dialog).getByRole('button', { name: 'Coba lagi' })
      await user.click(submit)
      await user.click(submit)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Coba lagi swap ini?' })).not.toBeInTheDocument())
      expect(calls).toBe(1)
    })

    test('should render no action buttons for STAFF and say why', async () => {
      setup(`/swap-bermasalah/${BUDI}`, 'stf_4')
      const m = await modal()
      expect(await within(m).findByTestId('mint-swap-no-action')).toHaveTextContent('Manager dan Admin')
      expect(within(m).queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument()
      expect(screen.getByTestId('mint-swap-readonly')).toBeInTheDocument()
    })

    test('should render no action buttons for DEVELOPER', async () => {
      setup(`/swap-bermasalah/${BUDI}`, 'stf_3')
      const m = await modal()
      await within(m).findByTestId('mint-swap-no-action')
      expect(within(m).queryByRole('button', { name: 'Tutup swap' })).not.toBeInTheDocument()
    })

    test('should render no buttons when the last attempt is still UNKNOWN', async () => {
      setup(`/swap-bermasalah/${ANDI}`)
      const m = await modal()
      expect(await within(m).findByTestId('mint-swap-no-action')).toHaveTextContent('menunggu jawaban bank')
      expect(within(m).queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument()
    })

    test('409 ALREADY_RESOLVED should be explained in the dialog and the data reloaded', async () => {
      const user = userEvent.setup()
      let detailReads = 0
      server.events.on('request:start', ({ request }) => {
        if (request.method === 'GET' && request.url.endsWith(`/api/v1/mint-swaps/${BUDI}`)) detailReads += 1
      })
      server.use(
        http.post('/api/v1/mint-swaps/:id/resolve', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'CONFLICT', message: 'ALREADY_RESOLVED' } },
            { status: 409 },
          ),
        ),
      )
      setup(`/swap-bermasalah/${BUDI}`)
      const m = await modal()
      await user.click(await within(m).findByRole('button', { name: 'Tutup swap' }))
      const dialog = await screen.findByRole('dialog', { name: 'Tutup swap tanpa ditukar?' })
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'Nasabah minta refund rupiah')
      const before = detailReads
      await user.click(within(dialog).getByRole('button', { name: 'Tutup swap' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('sudah diselesaikan orang lain')
      await waitFor(() => expect(detailReads).toBeGreaterThan(before))
    })
  })

  describe('edge cases', () => {
    test('should render an unknown issueCode as the code itself', async () => {
      server.use(
        http.get('/api/v1/mint-swaps', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 20, total: 1 },
            data: [
              {
                id: BUDI, mintOrderId: 'o', customerName: 'X', status: 'NEEDS_ACTION', issueCode: 'BRAND_NEW_CODE',
                amountUsdx: '1.000000', attemptCount: 0, queuedAt: '2026-11-02T00:00:00Z', waitingSeconds: 60,
              },
            ],
          }),
        ),
      )
      setup()
      expect(await screen.findByText('BRAND_NEW_CODE')).toBeInTheDocument()
    })

    test('should show an empty state, not an error, when the queue is clean', async () => {
      server.use(
        http.get('/api/v1/mint-swaps', () =>
          HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 20, total: 0 }, data: [] }),
        ),
      )
      setup()
      expect(await screen.findByText('Tidak ada swap bermasalah')).toBeInTheDocument()
    })
  })
})
