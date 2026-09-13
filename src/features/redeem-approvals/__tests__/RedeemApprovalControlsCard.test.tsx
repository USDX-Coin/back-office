import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/mocks/server'
import { configureRedeemApprovalControlsForTests, resetMockData } from '@/mocks/handlers'
import RedeemApprovalControlsCard from '@/features/redeem-approvals/RedeemApprovalControlsCard'
import { renderWithProviders } from '@/test/test-utils'

// USDX-669 — kartu ambang nominal persetujuan (`/api/v1/redeem-approval-controls`).
//
// Isian yang harus benar di seluruh tiket ini. `0` BUKAN "gerbang mati": ia
// keadaan paling ketat, semua pencairan wajib disetujui manusia. Menaikkannya
// berarti rupiah mulai keluar tanpa ada yang memeriksa rekening tujuannya — jadi
// yang diuji di sini bukan sekadar "form bisa disimpan", melainkan bahwa
// pelonggaran gerbang tidak pernah terjadi dalam satu tekan, dan bahwa
// pengetatannya tidak dibebani gesekan yang sama.
//
// Peran: stf_1 ADMIN · stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

function setup(staffId = 'stf_2') {
  return renderWithProviders(<RedeemApprovalControlsCard />, {
    initialEntries: ['/redeem-approvals'],
    staffId,
  })
}

/** Rekam body tiap `PUT` ke endpoint ambang — "tidak ada yang terkirim" harus bisa diuji. */
function recordThresholdWrites() {
  const writes: Array<{ approvalThresholdIdr?: unknown; reason?: unknown }> = []
  server.use(
    http.put('/api/v1/redeem-approval-controls', async ({ request }) => {
      const body = (await request.json()) as {
        approvalThresholdIdr?: unknown
        reason?: unknown
      }
      writes.push(body)
      return HttpResponse.json({
        status: 'success',
        metadata: null,
        data: {
          approvalThresholdIdr: String(body.approvalThresholdIdr),
          updatedAt: '2026-09-13T04:00:00.000Z',
          updatedByName: 'Linda Chen',
        },
      })
    }),
  )
  return writes
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Ubah ambang' }))
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  amount: string,
  reason: string,
) {
  const amountInput = screen.getByLabelText('Ambang baru (Rupiah)')
  await user.clear(amountInput)
  if (amount) await user.type(amountInput, amount)
  const reasonInput = screen.getByLabelText(/Alasan perubahan/)
  await user.clear(reasonInput)
  if (reason) await user.type(reasonInput, reason)
}

describe('RedeemApprovalControlsCard @ USDX-669', () => {
  describe('positive', () => {
    test('should show the default threshold as the strictest state, not as a gate that is off', async () => {
      setup()
      expect(await screen.findByTestId('threshold-active-value')).toHaveTextContent('Rp 0,00')
      expect(screen.getByTestId('threshold-meaning')).toHaveTextContent(
        /Semua pencairan wajib disetujui manusia/,
      )
      expect(screen.getByText('Paling ketat')).toBeInTheDocument()
    })

    test('should state the consequence when the threshold is above zero', async () => {
      configureRedeemApprovalControlsForTests({
        approvalThresholdIdr: '1000000.00',
        updatedAt: '2026-09-12T10:00:00.000Z',
        updatedByName: 'Linda Chen',
      })
      setup()
      expect(await screen.findByTestId('threshold-meaning')).toHaveTextContent(
        /Pencairan sampai Rp 1\.000\.000,00 dikirim otomatis tanpa persetujuan/,
      )
      // Selama ambangnya di atas nol, ada rupiah yang keluar tanpa dilihat siapa
      // pun — kartu harus mengatakannya, bukan hanya menampilkan angkanya.
      expect(screen.getByText(/ada rupiah yang keluar tanpa dilihat siapa pun/)).toBeInTheDocument()
      expect(screen.getByText(/oleh Linda Chen/)).toBeInTheDocument()
    })

    test('should save a LOWERED threshold straight away — tightening needs no confirmation', async () => {
      const user = userEvent.setup()
      configureRedeemApprovalControlsForTests({
        approvalThresholdIdr: '5000000.00',
        updatedAt: null,
        updatedByName: null,
      })
      const writes = recordThresholdWrites()
      setup()
      await openEditor(user)
      await fillForm(user, '0', 'Kembali ke wajib approve untuk semua nominal')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      await waitFor(() => expect(writes).toHaveLength(1))
      expect(writes[0]).toEqual({
        approvalThresholdIdr: '0',
        reason: 'Kembali ke wajib approve untuk semua nominal',
      })
      // Tidak ada dialog konfirmasi untuk arah yang aman.
      expect(screen.queryByTestId('threshold-raise-confirm')).not.toBeInTheDocument()
    })

    test('should send the amount and the reason only after the raise is confirmed', async () => {
      const user = userEvent.setup()
      const writes = recordThresholdWrites()
      setup()
      await openEditor(user)
      await fillForm(user, '1000000', 'Antrean menumpuk di jam sibuk')

      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))
      const confirm = await screen.findByRole('dialog')
      // Belum ada apa pun yang terkirim saat dialog muncul.
      expect(writes).toHaveLength(0)

      await user.click(within(confirm).getByRole('button', { name: /Ya, naikkan ambang/ }))
      await waitFor(() => expect(writes).toHaveLength(1))
      expect(writes[0]).toEqual({
        approvalThresholdIdr: '1000000',
        reason: 'Antrean menumpuk di jam sibuk',
      })
    })
  })

  describe('negative', () => {
    test('should not offer the editor to STAFF, and should say why', async () => {
      setup('stf_4')
      await screen.findByTestId('threshold-active-value')
      expect(screen.queryByRole('button', { name: 'Ubah ambang' })).not.toBeInTheDocument()
      expect(
        screen.getByText(/Hanya Manager dan Admin yang bisa mengubah ambang/),
      ).toBeInTheDocument()
    })

    test('should not offer the editor to DEVELOPER', async () => {
      setup('stf_3')
      await screen.findByTestId('threshold-active-value')
      expect(screen.queryByRole('button', { name: 'Ubah ambang' })).not.toBeInTheDocument()
    })

    test('should refuse to save without a reason — nothing sent', async () => {
      const user = userEvent.setup()
      const writes = recordThresholdWrites()
      setup()
      await openEditor(user)
      await fillForm(user, '2000000', '')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      expect(await screen.findByText('Alasan perubahan wajib diisi')).toBeInTheDocument()
      // Alasan wajib diperiksa SEBELUM konfirmasi kenaikan: dialog yang muncul
      // lebih dulu akan meminta operator menegaskan perubahan yang tetap gagal.
      expect(screen.queryByTestId('threshold-raise-confirm')).not.toBeInTheDocument()
      expect(writes).toHaveLength(0)
    })

    test('should refuse a rupiah amount typed with thousand separators — nothing sent', async () => {
      const user = userEvent.setup()
      const writes = recordThresholdWrites()
      setup()
      await openEditor(user)
      await fillForm(user, '1.000.000', 'Coba longgarkan sedikit')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      expect(
        await screen.findByText(/Tulis nominal rupiah tanpa titik atau koma/),
      ).toBeInTheDocument()
      expect(writes).toHaveLength(0)
    })

    test('should show a 403 as a sentence naming the roles, not the raw error', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      server.use(
        http.put('/api/v1/redeem-approval-controls', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'UNPREDICTED_CODE', message: 'Forbidden resource' },
            },
            { status: 403 },
          ),
        ),
      )
      setup()
      await openEditor(user)
      await fillForm(user, '0', 'Tidak berubah, hanya uji izin')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      await waitFor(() => expect(errSpy).toHaveBeenCalled())
      const message = String(errSpy.mock.calls[0]?.[0])
      expect(message).toMatch(/Manager dan Admin/)
      expect(message).not.toMatch(/Forbidden resource|UNPREDICTED_CODE/)
    })
  })

  describe('edge cases', () => {
    test('should demand confirmation for a raise from zero, naming both values and the consequence', async () => {
      const user = userEvent.setup()
      setup()
      await openEditor(user)
      await fillForm(user, '1000000', 'Melepas pencairan kecil')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      const confirm = await screen.findByRole('dialog')
      expect(
        within(confirm).getByText('Lepas pencairan dari pengawasan manusia?'),
      ).toBeInTheDocument()
      expect(within(confirm).getByText(/Ambang naik dari Rp 0,00 ke Rp 1\.000\.000,00/)).toBeInTheDocument()
      expect(within(confirm).getByTestId('threshold-raise-confirm')).toHaveTextContent(
        /tanpa ada yang memeriksa rekening tujuannya/,
      )
    })

    test('should also demand confirmation for a raise that does not start at zero', async () => {
      // Naik dari Rp 1 juta ke Rp 1 miliar juga melepas rupiah yang sebelumnya
      // dilihat manusia; AC menyebut kasus dari-nol, dan ini supersetnya.
      const user = userEvent.setup()
      const writes = recordThresholdWrites()
      configureRedeemApprovalControlsForTests({
        approvalThresholdIdr: '1000000.00',
        updatedAt: null,
        updatedByName: null,
      })
      setup()
      await openEditor(user)
      await fillForm(user, '1000000000', 'Naikkan plafon otomatis')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      const confirm = await screen.findByRole('dialog')
      expect(within(confirm).getByText('Longgarkan gerbang pencairan?')).toBeInTheDocument()
      expect(writes).toHaveLength(0)
    })

    test('should let the operator back out of a raise with nothing sent', async () => {
      const user = userEvent.setup()
      const writes = recordThresholdWrites()
      setup()
      await openEditor(user)
      await fillForm(user, '750000', 'Hampir saja')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      const confirm = await screen.findByRole('dialog')
      await user.click(within(confirm).getByRole('button', { name: /^Batal$/ }))
      expect(writes).toHaveLength(0)
      // Isian tetap terisi — membatalkan konfirmasi bukan membuang pekerjaan.
      expect(screen.getByLabelText('Ambang baru (Rupiah)')).toHaveValue('750000')
    })

    test('should DEMAND confirmation when the current threshold cannot be read', async () => {
      // Fail-closed. Kalau server mengirim nilai yang tidak terbaca sebagai rupiah,
      // layar tidak bisa memastikan perubahan ini mengetatkan atau melonggarkan —
      // dan satu-satunya pagar sebelum melonggarkan payout tidak boleh mati persis
      // di keadaan itu. Dialognya juga tidak boleh mengklaim "naik dari X".
      const user = userEvent.setup()
      const writes = recordThresholdWrites()
      configureRedeemApprovalControlsForTests({
        approvalThresholdIdr: '1,000,000',
        updatedAt: null,
        updatedByName: null,
      })
      setup()
      await openEditor(user)
      await fillForm(user, '5000000', 'Setel ulang setelah nilai lama kacau')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      const confirm = await screen.findByRole('dialog')
      expect(writes).toHaveLength(0)
      expect(
        within(confirm).getByText('Setel ambang tanpa tahu nilai sekarang?'),
      ).toBeInTheDocument()
      expect(within(confirm).getByTestId('threshold-raise-confirm')).toHaveTextContent(
        /tidak bisa memastikan apakah perubahan ini mengetatkan atau melonggarkan/,
      )
      // Tombolnya tidak boleh berbunyi "naikkan" untuk arah yang tak diketahui.
      expect(within(confirm).getByRole('button', { name: 'Ya, setel ambang' })).toBeInTheDocument()

      await user.click(within(confirm).getByRole('button', { name: 'Ya, setel ambang' }))
      await waitFor(() => expect(writes).toHaveLength(1))
      expect(writes[0]).toEqual({
        approvalThresholdIdr: '5000000',
        reason: 'Setel ulang setelah nilai lama kacau',
      })
    })

    test('should not offer the editor at all while the active threshold failed to load', async () => {
      // Mengubah ambang yang nilai sekarangnya belum terbaca berarti menimpa
      // keadaan gerbang uang tanpa tahu keadaan itu. Kartunya menawarkan "Coba
      // lagi" di tempat tombol itu biasanya berada.
      server.use(
        http.get('/api/v1/redeem-approval-controls', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL', message: 'boom' },
            },
            { status: 500 },
          ),
        ),
      )
      setup()
      expect(
        await screen.findByText(/Ambang aktif gagal dimuat/),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ubah ambang' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
    })

    test('should not ask for confirmation when the value is unchanged', async () => {
      const user = userEvent.setup()
      const writes = recordThresholdWrites()
      configureRedeemApprovalControlsForTests({
        approvalThresholdIdr: '1000000.00',
        updatedAt: null,
        updatedByName: null,
      })
      setup()
      await openEditor(user)
      // `1000000` dan `1000000.00` adalah nilai yang SAMA — pembandingannya sen
      // bulat, bukan perbandingan string.
      await fillForm(user, '1000000', 'Perbaiki catatan alasan saja')
      await user.click(screen.getByRole('button', { name: 'Simpan ambang' }))

      await waitFor(() => expect(writes).toHaveLength(1))
      expect(screen.queryByTestId('threshold-raise-confirm')).not.toBeInTheDocument()
    })
  })
})
