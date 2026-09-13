import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { server } from '@/mocks/server'
import { configurePayoutsEnabledForTests, resetMockData } from '@/mocks/handlers'
import { PAYOUT_FAILURE_MOCK_IDS as IDS } from '@/mocks/data'
import PayoutFailuresPage from '@/features/payout-failures/PayoutFailuresPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-662 — aksi resolve dari detail (§ 17.4 aksi per jenis, § 17.5 aturan form & peran).
// Peran: stf_1 ADMIN · stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

const REASON = 'Ditransfer treasury lewat BNIdirect'
const ACTION_BUTTONS = /^(Kirim ulang|Tandai dibayar manual|Tutup tanpa pembayaran)$/

function setup(path: string, staffId = 'stf_2') {
  return renderWithProviders(
    <Routes>
      <Route path="/payout-failures" element={<PayoutFailuresPage />} />
      <Route path="/payout-failures/:id" element={<PayoutFailuresPage />} />
    </Routes>,
    { initialEntries: [path], staffId },
  )
}

async function openDetail(id: string, staffId?: string) {
  setup(`/payout-failures/${id}`, staffId)
  const detail = await screen.findByRole('dialog')
  await within(detail).findByTestId('payout-failure-net-idr')
  return detail
}

/** Judul dialog resolve per label tombol aksi. */
const RESOLVE_TITLES: Record<string, string> = {
  'Kirim ulang': 'Kirim ulang payout',
  'Tandai dibayar manual': 'Tandai sudah dibayar manual',
  'Tutup tanpa pembayaran': 'Tutup tanpa pembayaran',
}

/**
 * Klik satu aksi di detail; kembalikan dialog resolve.
 *
 * Dicari lewat JUDULNYA, bukan jumlah dialog: saat dialog bersarang terbuka Radix
 * menandai modal detail `aria-hidden`, jadi pohon aksesibilitas hanya memuat satu
 * dialog — yang paling atas.
 */
async function chooseAction(detail: HTMLElement, name: string) {
  const user = userEvent.setup()
  await user.click(within(detail).getByRole('button', { name }))
  const dialog = await screen.findByRole('dialog', { name: RESOLVE_TITLES[name] })
  return { user, dialog }
}

async function waitResolveClosed(name: string) {
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: RESOLVE_TITLES[name] })).not.toBeInTheDocument(),
  )
}

describe('ResolvePayoutFailureDialog @ USDX-662', () => {
  describe('positive', () => {
    test('should settle manually, drop the row from the queue and show the resolution trail', async () => {
      const detail = await openDetail(IDS.failedRejected)
      const { user, dialog } = await chooseAction(detail, 'Tandai dibayar manual')

      await user.type(within(dialog).getByLabelText(/Nomor referensi transfer bank/), 'TRX-778812')
      await user.type(within(dialog).getByLabelText(/^Alasan/), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Tandai dibayar manual' }))

      await waitResolveClosed('Tandai dibayar manual')
      const refreshed = screen.getByRole('dialog')
      expect(await within(refreshed).findByTestId('resolved-note')).toHaveTextContent('Dibayar di luar sistem')
      expect(within(within(refreshed).getByTestId('reviews')).getByText('TRX-778812')).toBeInTheDocument()
      expect(within(refreshed).queryByRole('button', { name: ACTION_BUTTONS })).not.toBeInTheDocument()

      // Antrean diperiksa SETELAH modal ditutup: selama modal terbuka isi halaman di
      // belakangnya `aria-hidden`, dan "baris hilang" akan lolos tanpa membuktikan apa pun.
      await user.click(within(refreshed).getByRole('button', { name: 'Tutup' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(await screen.findByRole('button', { name: /Buka detail pencairan DEWI KARTIKA/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Buka detail pencairan RINA SUSANTI/ })).not.toBeInTheDocument()
    })

    test('should offer all three actions on PAYOUT_FAILED to an ADMIN', async () => {
      const detail = await openDetail(IDS.failedRejected, 'stf_1')
      expect(within(detail).getAllByRole('button', { name: ACTION_BUTTONS }).map((b) => b.textContent)).toEqual([
        'Kirim ulang',
        'Tandai dibayar manual',
        'Tutup tanpa pembayaran',
      ])
    })

    test('should resend without any field to type an account number', async () => {
      const detail = await openDetail(IDS.failedAfterResend)
      const { user, dialog } = await chooseAction(detail, 'Kirim ulang')
      // Satu-satunya isian adalah alasan — tidak ada input teks selain textarea itu.
      expect(within(dialog).queryAllByRole('textbox')).toHaveLength(1)
      expect(within(dialog).getByTestId('resolve-consequence')).toHaveTextContent('0010144778')
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'Bank tujuan sudah pulih, kirim ulang')
      await user.click(within(dialog).getByRole('button', { name: 'Kirim ulang' }))
      await waitResolveClosed('Kirim ulang')
      expect(await within(screen.getByRole('dialog')).findByTestId('resolved-note')).toHaveTextContent('Dikirim ulang')
    })
  })

  describe('negative', () => {
    test('should keep SETTLED_MANUAL disabled without an external reference', async () => {
      const detail = await openDetail(IDS.failedRejected)
      const { user, dialog } = await chooseAction(detail, 'Tandai dibayar manual')
      await user.type(within(dialog).getByLabelText(/^Alasan/), REASON)
      expect(within(dialog).getByRole('button', { name: 'Tandai dibayar manual' })).toBeDisabled()
    })

    test('should keep submit disabled while the reason is under 10 characters', async () => {
      const detail = await openDetail(IDS.failedRejected)
      const { user, dialog } = await chooseAction(detail, 'Tutup tanpa pembayaran')
      await user.type(within(dialog).getByLabelText(/^Alasan/), '123456789')
      expect(within(dialog).getByRole('button', { name: 'Tutup tanpa pembayaran' })).toBeDisabled()
      await user.type(within(dialog).getByLabelText(/^Alasan/), '0')
      expect(within(dialog).getByRole('button', { name: 'Tutup tanpa pembayaran' })).toBeEnabled()
    })

    test('should not offer RESENT on BURN_REJECTED', async () => {
      const detail = await openDetail(IDS.burnRejected)
      expect(within(detail).getAllByRole('button', { name: ACTION_BUTTONS }).map((b) => b.textContent)).toEqual([
        'Tandai dibayar manual',
        'Tutup tanpa pembayaran',
      ])
    })

    test('should offer no action at all on PAYOUT_STUCK', async () => {
      const detail = await openDetail(IDS.stuck)
      expect(within(detail).queryByRole('button', { name: ACTION_BUTTONS })).not.toBeInTheDocument()
    })

    test('should show no resolve button to STAFF or DEVELOPER', async () => {
      const staff = await openDetail(IDS.failedRejected, 'stf_4')
      expect(within(staff).queryByRole('button', { name: ACTION_BUTTONS })).not.toBeInTheDocument()
    })

    test('should turn a 403 into a sentence naming the roles', async () => {
      server.use(
        http.post('/api/v1/payout-failures/:id/resolve', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'FORBIDDEN', message: 'FORBIDDEN' } },
            { status: 403 },
          ),
        ),
      )
      const detail = await openDetail(IDS.failedRejected)
      const { user, dialog } = await chooseAction(detail, 'Tutup tanpa pembayaran')
      await user.type(within(dialog).getByLabelText(/^Alasan/), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Tutup tanpa pembayaran' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Manager dan Admin')
    })
  })

  describe('edge cases', () => {
    test('should explain a 409 ALREADY_RESOLVED inside the dialog and not hang', async () => {
      server.use(
        http.post('/api/v1/payout-failures/:id/resolve', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'CONFLICT', message: 'ALREADY_RESOLVED' } },
            { status: 409 },
          ),
        ),
      )
      const detail = await openDetail(IDS.failedRejected)
      const { user, dialog } = await chooseAction(detail, 'Tutup tanpa pembayaran')
      await user.type(within(dialog).getByLabelText(/^Alasan/), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Tutup tanpa pembayaran' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('sudah diselesaikan orang lain')
      expect(within(dialog).getByRole('button', { name: 'Tutup tanpa pembayaran' })).toBeEnabled()
      expect(within(dialog).getByRole('button', { name: 'Batal' })).toBeEnabled()
    })

    test('should say the payout brake is pulled when RESENT meets PAYOUT_DISABLED', async () => {
      configurePayoutsEnabledForTests(false)
      const detail = await openDetail(IDS.failedRejected)
      const { user, dialog } = await chooseAction(detail, 'Kirim ulang')
      await user.type(within(dialog).getByLabelText(/^Alasan/), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Kirim ulang' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Rem payout sedang ditarik')
    })

    test('should clear the typed reason when another action is chosen', async () => {
      const detail = await openDetail(IDS.failedRejected)
      const first = await chooseAction(detail, 'Tutup tanpa pembayaran')
      await first.user.type(within(first.dialog).getByLabelText(/^Alasan/), REASON)
      await first.user.click(within(first.dialog).getByRole('button', { name: 'Batal' }))
      await waitResolveClosed('Tutup tanpa pembayaran')

      const second = await chooseAction(screen.getByRole('dialog'), 'Tandai dibayar manual')
      expect(within(second.dialog).getByLabelText(/^Alasan/)).toHaveValue('')
    })
  })
})
