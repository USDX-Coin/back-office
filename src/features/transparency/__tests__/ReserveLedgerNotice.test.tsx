import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/mocks/server'
import { findStaffByEmail, resetMockData } from '@/mocks/handlers'
import TransparencyPage from '@/features/transparency/TransparencyPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-770 (D26, `sot/bni-integration.md` § 18.5): sesudah D26 angka cadangan
// publik = saldo Giro USD BNI, bukan buku besar ini. Teks di bawah DISALIN dari
// SOT, bukan diimpor dari konstanta kode — kalau kodenya bergeser dari SOT,
// test inilah yang merah.
const SOT_18_5_NOTICE =
  'Catatan internal — tidak tayang di halaman publik. Angka cadangan publik = saldo Giro USD BNI yang dibaca otomatis dari bank tiap menit (lihat menu Rekening BNI).'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

/**
 * Klaim lama bahwa entri buku besar mengubah/menayangkan angka di usdx.co.id.
 * Kalimat atestasi tidak ikut diperiksa — PDF-nya memang terbit di usdx.co.id.
 */
const LEDGER_PUBLIC_CLAIM = /usdx\.co\.id|angka (cadangan )?publik|cadangan publik/i

function renderAs(email: string) {
  return renderWithProviders(<TransparencyPage />, {
    initialEntries: ['/transparency'],
    staffId: findStaffByEmail(email)!.id,
  })
}

/** Buka form catat entri dan isi sampai lolos validasi; kembalikan dialog form. */
async function openFilledEntryForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^catat entri$/i }))
  const form = await screen.findByRole('dialog', { name: /catat entri buku besar/i })
  await user.click(within(form).getAllByRole('radio').find((r) => (r as HTMLInputElement).value === 'SEED')!)
  await user.type(within(form).getByLabelText(/^nominal$/i), '100667.41')
  await user.type(within(form).getByLabelText(/^alasan$/i), 'Setoran giro USD untuk penambahan cadangan')
  fireEvent.change(within(form).getByLabelText(/^tanggal kejadian$/i), { target: { value: '2026-07-23' } })
  return form
}


describe('Transparansi — keterangan buku besar tidak tayang publik (§ 18.5)', () => {
  describe('positive', () => {
    test('ADMIN reads the exact § 18.5 text in the reserve card before the entry form is opened', async () => {
      renderAs('demo@usdx.io')
      const notice = await screen.findByTestId('reserve-ledger-notice')
      expect(notice).toHaveTextContent(SOT_18_5_NOTICE)
      expect(notice).toHaveAttribute('role', 'note')

      // Form entri masih tertutup — keterangannya sudah terbaca lebih dulu.
      expect(screen.queryByRole('dialog', { name: /catat entri buku besar/i })).not.toBeInTheDocument()
      // Keterangan duduk di kartu yang sama dengan tombol pembuka form.
      const card = screen.getByTestId('reserve-balance-card')
      expect(within(card).getByTestId('reserve-ledger-notice')).toBe(notice)
      expect(within(card).getByRole('button', { name: /^catat entri$/i })).toBeInTheDocument()
    })

    test('DEVELOPER (read-only) sees the same notice', async () => {
      renderAs('marcus.a@usdx.io')
      expect(await screen.findByTestId('reserve-ledger-notice')).toHaveTextContent(SOT_18_5_NOTICE)
      expect(screen.queryByRole('button', { name: /^catat entri$/i })).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('the notice is rendered once, not repeated inside the entry form', async () => {
      const user = userEvent.setup()
      renderAs('demo@usdx.io')
      await user.click(await screen.findByRole('button', { name: /^catat entri$/i }))
      const form = await screen.findByRole('dialog', { name: /catat entri buku besar/i })
      expect(within(form).queryByTestId('reserve-ledger-notice')).not.toBeInTheDocument()
      expect(screen.getAllByTestId('reserve-ledger-notice')).toHaveLength(1)
    })

    test('the reserve card no longer claims its figure is what usdx.co.id shows', async () => {
      renderAs('demo@usdx.io')
      const card = await screen.findByTestId('reserve-balance-card')
      await within(card).findByText(/jumlah seluruh entri di buku besar/i)
      expect(card).not.toHaveTextContent(/yang tayang di usdx\.co\.id/i)
      expect(card).not.toHaveTextContent(/halaman publik belum menampilkan/i)
    })

    test.each([
      ['ADMIN', 'demo@usdx.io'],
      ['DEVELOPER', 'marcus.a@usdx.io'],
    ])('the page subtitle for %s does not say ledger entries change the public figure', async (_role, email) => {
      renderAs(email)
      const heading = await screen.findByRole('heading', { name: /cadangan & atestasi/i })
      const header = heading.parentElement as HTMLElement
      expect(header).toHaveTextContent(/buku besar cadangan internal/i)
      expect(header).not.toHaveTextContent(/mengubah angka cadangan yang tayang/i)
      expect(header).not.toHaveTextContent(/di balik angka publik/i)
    })

    // § 18.5 (amandemen 22 Okt, review back-office#129): perilaku form, dialog
    // konfirmasi, dan riwayat tetap, tapi kalimat yang menyatakan entri
    // mengubah/menayangkan angka cadangan di usdx.co.id dikoreksi.
    test('the entry form and its confirmation dialog do not say an entry changes the figure on usdx.co.id', async () => {
      const user = userEvent.setup()
      renderAs('demo@usdx.io')
      const form = await openFilledEntryForm(user)
      expect(form).not.toHaveTextContent(LEDGER_PUBLIC_CLAIM)

      await user.click(within(form).getByRole('button', { name: /periksa lalu catat/i }))
      const confirm = await screen.findByRole('dialog', { name: /catat entri ini ke buku besar cadangan\?/i })
      expect(confirm).not.toHaveTextContent(LEDGER_PUBLIC_CLAIM)
    })

    test('a confirmation blocked by an unknown balance does not mention the figure on usdx.co.id', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 },
          ),
        ),
      )
      renderAs('demo@usdx.io')
      const form = await openFilledEntryForm(user)
      await user.click(within(form).getByRole('button', { name: /periksa lalu catat/i }))
      const confirm = await screen.findByRole('dialog', { name: /catat entri ini ke buku besar cadangan\?/i })
      const blocked = within(confirm).getByRole('alert')
      expect(blocked).toHaveTextContent(/saldo cadangan saat ini gagal dimuat/i)
      expect(blocked).not.toHaveTextContent(LEDGER_PUBLIC_CLAIM)
    })

    test('the empty ledger history does not promise the figure will show on usdx.co.id', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { entries: [], page: 1, take: 50, total: 0, balance: { amount: '0.00', currency: 'USD' } },
          }),
        ),
      )
      renderAs('demo@usdx.io')
      const empty = await screen.findByText(/belum ada entri buku besar/i)
      const cell = empty.closest('td') as HTMLElement
      expect(cell).toHaveTextContent(/buku besar cadangan internal/i)
      expect(cell).not.toHaveTextContent(LEDGER_PUBLIC_CLAIM)
    })
  })

  describe('edge case', () => {
    test('stays visible while the ledger is still loading', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', async () => {
          await delay('infinite')
          return HttpResponse.json({})
        }),
      )
      renderAs('demo@usdx.io')
      expect(await screen.findByTestId('reserve-ledger-notice')).toHaveTextContent(SOT_18_5_NOTICE)
    })

    test('stays visible when the ledger request fails', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 },
          ),
        ),
      )
      renderAs('demo@usdx.io')
      expect(await screen.findByTestId('reserve-ledger-notice')).toHaveTextContent(SOT_18_5_NOTICE)
    })
  })
})
