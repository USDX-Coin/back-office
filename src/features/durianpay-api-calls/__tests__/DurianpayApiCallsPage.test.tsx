import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import DurianpayApiCallsPage from '@/features/durianpay-api-calls/DurianpayApiCallsPage'
import { renderWithProviders } from '@/test/test-utils'

// Log Panggilan DurianPay — daftar panggilan KELUAR. Handler MSW bawaan (8 baris
// seed). Peran: stf_1 ADMIN · stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.
// Backendnya membuka layar ini untuk MANAGER / ADMIN / DEVELOPER saja.

const LIST_PATH = '/api/v1/durianpay-api-calls'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
  localStorage.clear()
})
afterAll(() => server.close())

function setup(path = '/durianpay-api-calls', staffId = 'stf_2') {
  return renderWithProviders(<DurianpayApiCallsPage />, { initialEntries: [path], staffId })
}

function recordListQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === LIST_PATH) seen.push(url.search)
  })
  return seen
}

function rowFor(container: HTMLElement, text: string): HTMLElement {
  const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
  const row = rows.find((r) => r.textContent?.includes(text))
  if (!row) throw new Error(`no row containing ${text}`)
  return row
}

describe('DurianpayApiCallsPage', () => {
  describe('positive', () => {
    test('should answer kapan / ke mana / berhasil atau tidak / order mana without any SNAP jargon', async () => {
      const { container } = setup()
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      const row = rowFor(container, 'MNT7K2X9QP')
      // kapan
      expect(within(row).getByText(/2026-09-18 09:00:00 WIB/)).toBeInTheDocument()
      // ke mana — kalimat manusia DI ATAS path mentahnya, bukan sebagai gantinya
      expect(within(row).getByText('Buat nomor VA untuk nasabah')).toBeInTheDocument()
      expect(
        within(row).getByText('POST /v1.0/transfer-va/create-va'),
      ).toBeInTheDocument()
      // berhasil atau tidak
      expect(within(row).getByText('Berhasil')).toBeInTheDocument()
      expect(within(row).getByText('HTTP 200')).toBeInTheDocument()
      // order mana
      expect(within(row).getByText('MNT7K2X9QP')).toBeInTheDocument()
    })

    test('should put the reason for a failure on the row itself', async () => {
      const { container } = setup()
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      const row = rowFor(container, 'MNT4QW8ZR1')
      expect(within(row).getByText('Tidak jelas')).toBeInTheDocument()
      expect(
        within(row).getByText('HTTP 500 responseCode=5002701 Internal Server Error'),
      ).toBeInTheDocument()
    })

    test('should order newest first, the way the server does', async () => {
      const { container } = setup()
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(8)
      expect(rows[0]!.textContent).toContain('MNT7K2X9QP')
      expect(rows[rows.length - 1]!.textContent).toContain('Kirim rupiah (jalur lama)')
    })
  })

  describe('negative', () => {
    test('should NOT call a 2xx that the envelope refused inside berhasil', async () => {
      // `summarize()` di backend mengisi errorSummary walau outcome-nya SUCCESS,
      // dan kelas kejadian itu yang paling mudah luput karena statusnya hijau.
      const { container } = setup()
      await screen.findByText('Cek status tagihan VA')
      const row = rowFor(container, 'MNT9LD3TVB')
      expect(within(row).getByText('HTTP 200')).toBeInTheDocument()
      expect(within(row).getByText('Ditolak di dalam jawaban')).toBeInTheDocument()
      expect(within(row).queryByText('Berhasil')).not.toBeInTheDocument()
    })

    test('should say "tanpa jawaban" for a timeout instead of an em dash', async () => {
      const { container } = setup()
      await screen.findByText('Cek status kiriman rupiah')
      const row = rowFor(container, 'Cek status kiriman rupiah')
      expect(within(row).getByText('tanpa jawaban')).toBeInTheDocument()
    })

    test('should render an error state, not an empty log, when the list fails', async () => {
      server.use(
        http.get(LIST_PATH, () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL_SERVER_ERROR', message: 'x' },
            },
            { status: 500 },
          ),
        ),
      )
      setup()
      await waitFor(() =>
        expect(screen.queryByText('Belum ada panggilan tercatat')).not.toBeInTheDocument(),
      )
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    test('should offer no free-text search box — the endpoint has none', async () => {
      // Kotak cari yang tidak didukung membuat operator menyimpulkan datanya
      // tidak ada. `DataTable` merender kotak itu sendiri kalau tidak diberi
      // `filterToolbar`, jadi ini menjaga toolbarnya tetap terpasang.
      setup()
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /^search$/i })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument()
    })
  })

  describe('filters', () => {
    test('should send a picked day as a WIB instant, not a bare date', async () => {
      const seen = recordListQueries()
      setup('/durianpay-api-calls?from=2026-09-18&to=2026-09-18')
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      const last = seen[seen.length - 1]!
      const sp = new URLSearchParams(last)
      expect(sp.get('from')).toBe('2026-09-18T00:00:00+07:00')
      expect(sp.get('to')).toBe('2026-09-18T23:59:59.999+07:00')
    })

    test('should send an exact referenceNo and show only that order', async () => {
      const seen = recordListQueries()
      const { container } = setup('/durianpay-api-calls?referenceNo=RDM5HG2NMC')
      await screen.findByText('Kirim rupiah ke rekening nasabah')
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(2)
      expect(seen.some((q) => q.includes('referenceNo=RDM5HG2NMC'))).toBe(true)
    })

    test('should treat the endpoint filter as a PREFIX, catching both VA calls at once', async () => {
      const { container } = setup('/durianpay-api-calls?path=%2Fv1.0%2Ftransfer-va')
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(3)
      expect(screen.getByText('Cek status tagihan VA')).toBeInTheDocument()
      expect(screen.queryByText('Kirim rupiah ke rekening nasabah')).not.toBeInTheDocument()
    })

    test('should show a no-results state (not the empty-log state) when a filter matches nothing', async () => {
      setup('/durianpay-api-calls?responseCode=9999999')
      expect(await screen.findByText(/No results match your filters/i)).toBeInTheDocument()
      expect(screen.queryByText('Belum ada panggilan tercatat')).not.toBeInTheDocument()
    })

    test('should write a filter typed in the popover to the URL and reset to page 1', async () => {
      const user = userEvent.setup()
      const seen = recordListQueries()
      setup('/durianpay-api-calls?page=2')
      await waitFor(() => expect(seen.length).toBeGreaterThan(0))
      await user.click(screen.getByRole('button', { name: /^filter$/i }))
      await user.type(await screen.findByLabelText('Nomor order'), 'MNT4QW8ZR1')
      await user.click(screen.getByRole('button', { name: /^apply$/i }))
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      const sp = new URLSearchParams(seen[seen.length - 1]!)
      expect(sp.get('referenceNo')).toBe('MNT4QW8ZR1')
      expect(sp.get('page')).toBe('1')
    })
  })

  describe('edge cases', () => {
    test('should not send an outcome the contract does not know', async () => {
      const seen = recordListQueries()
      setup('/durianpay-api-calls?outcome=NOPE')
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      expect(seen.every((q) => !q.includes('outcome'))).toBe(true)
    })

    test('should not send an httpStatus outside the contract range', async () => {
      const seen = recordListQueries()
      setup('/durianpay-api-calls?httpStatus=99')
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      expect(seen.every((q) => !q.includes('httpStatus'))).toBe(true)
    })

    test('should say "tanpa nomor order" for calls that carry none, rather than an em dash', async () => {
      const { container } = setup()
      await screen.findByText('Ambil token akses')
      const row = rowFor(container, 'Ambil token akses')
      expect(within(row).getByText('tanpa nomor order')).toBeInTheDocument()
    })

    test('should hide the Integrasi column by default and reveal it on request', async () => {
      const user = userEvent.setup()
      setup()
      await screen.findAllByText('Buat nomor VA untuk nasabah')
      expect(screen.queryByRole('columnheader', { name: 'Integrasi' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /^columns$/i }))
      await user.click(await screen.findByRole('checkbox', { name: 'Integrasi' }))
      expect(
        await screen.findByRole('columnheader', { name: 'Integrasi' }),
      ).toBeInTheDocument()
    })

    test('should explain an empty log without blaming a filter', async () => {
      server.use(
        http.get(LIST_PATH, () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 20, total: 0 },
            data: [],
          }),
        ),
      )
      setup()
      expect(await screen.findByText('Belum ada panggilan tercatat')).toBeInTheDocument()
    })
  })
})
