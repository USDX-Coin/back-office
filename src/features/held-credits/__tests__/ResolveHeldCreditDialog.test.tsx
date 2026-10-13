import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { createMockHeldCredits, HELD_CREDIT_MOCK_IDS, HELD_CREDIT_ORDER_MOCK_IDS } from '@/mocks/data'
import ResolveHeldCreditDialog from '@/features/held-credits/ResolveHeldCreditDialog'
import { renderWithProviders } from '@/test/test-utils'
import type { HeldCreditDetail } from '@/features/held-credits/types'

// ─────────────────────────────────────────────────────────────────────────────
// JALAN BUNTU YANG DITUTUP DI SINI (USDX-486 + USDX-342).
//
// Resolve kredit di atas Rp 10 juta menjawab `202` dan MELAHIRKAN USULAN, bukan
// menyelesaikan apa pun. Sebelum layar Persetujuan Orang Kedua ada, jalur itu
// mentok total: operator menekan tombol, server membuat usulan, dan tidak ada
// satu pun permukaan untuk menyetujuinya.
//
// Berkas ini menjaga dua hal: (1) dialog tidak pernah mengaku "berhasil" atas
// jawaban 202, dan (2) ia memberi jalan ke usulannya.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function creditFixture(id: string): HeldCreditDetail {
  return createMockHeldCredits().get(id)!
}

function setup(credit: HeldCreditDetail, action: 'PAID' | 'FAILED', staffId = 'stf_2') {
  return renderWithProviders(
    <ResolveHeldCreditDialog credit={credit} action={action} open onOpenChange={() => {}} />,
    { initialEntries: ['/mint-bermasalah'], staffId }
  )
}

function captureResolveBody(creditId: string) {
  const seen: unknown[] = []
  server.events.on('request:start', async ({ request }) => {
    if (!request.url.includes(`/held-credits/${creditId}/resolve`)) return
    seen.push(await request.clone().json())
  })
  return seen
}

describe('ResolveHeldCreditDialog @ USDX-342', () => {
  describe('positive', () => {
    test('kredit kecil dengan order pilihan mesin selesai seketika', async () => {
      const user = userEvent.setup()
      const credit = creditFixture(HELD_CREDIT_MOCK_IDS.latePayment)
      const body = captureResolveBody(credit.id)
      setup(credit, 'PAID')

      await user.type(
        screen.getByLabelText(/^Alasan/),
        'cocok dengan rekening koran BNI jam 09.15'
      )
      await user.click(screen.getByRole('button', { name: 'Terima kredit dan lekatkan ke order' }))

      await waitFor(() => expect(body).toHaveLength(1))
      expect(body[0]).toEqual({
        action: 'PAID',
        reason: 'cocok dengan rekening koran BNI jam 09.15',
      })
      // Tidak ada panel "menunggu orang kedua" untuk jalur di bawah ambang.
      await waitFor(() =>
        expect(screen.queryByTestId('menunggu-orang-kedua')).not.toBeInTheDocument()
      )
    })

    test('kredit di bawah ambang TIDAK diberi peringatan empat mata', () => {
      setup(creditFixture(HELD_CREDIT_MOCK_IDS.latePayment), 'PAID')
      expect(screen.queryByTestId('peringatan-orang-kedua')).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('202 TIDAK diakui sebagai berhasil — dialog berubah jadi tautan ke usulannya', async () => {
      const user = userEvent.setup()
      const credit = creditFixture(HELD_CREDIT_MOCK_IDS.noMatch)
      setup(credit, 'PAID')

      // Kredit ini tidak cocok ke order mana pun, jadi ordernya wajib disebut.
      const submit = screen.getByRole('button', { name: 'Terima kredit dan lekatkan ke order' })
      expect(submit).toBeDisabled()

      await user.type(screen.getByLabelText(/Order yang dilunasi/), HELD_CREDIT_ORDER_MOCK_IDS.manual)
      await user.type(screen.getByLabelText(/^Alasan/), 'dicocokkan manual dengan rekening koran')
      expect(submit).toBeEnabled()
      await user.click(submit)

      const panel = await screen.findByTestId('menunggu-orang-kedua')
      expect(panel).toHaveTextContent(/Belum selesai/)
      expect(panel).toHaveTextContent(/Jangan menekan tombol yang sama lagi/)
      expect(screen.getByRole('button', { name: /Buka usulannya/ })).toBeInTheDocument()
    })

    test('memperingatkan empat mata SEBELUM dikirim, bukan sesudah', async () => {
      // Tombol yang kadang menyelesaikan dan kadang tidak, tanpa diberi tahu
      // lebih dulu yang mana, membuat orang menekannya dua kali.
      setup(creditFixture(HELD_CREDIT_MOCK_IDS.noMatch), 'PAID')
      expect(await screen.findByTestId('peringatan-orang-kedua')).toHaveTextContent(
        /TIDAK menyelesaikan kredit/
      )
    })

    test('menamai order di luar pilihan mesin memicu peringatan empat mata, berapa pun nominalnya', async () => {
      const user = userEvent.setup()
      setup(creditFixture(HELD_CREDIT_MOCK_IDS.latePayment), 'PAID')
      expect(screen.queryByTestId('peringatan-orang-kedua')).not.toBeInTheDocument()
      await user.type(
        screen.getByLabelText(/Order yang dilunasi/),
        HELD_CREDIT_ORDER_MOCK_IDS.manual
      )
      expect(await screen.findByTestId('peringatan-orang-kedua')).toHaveTextContent(
        /bukan pilihan mesin/
      )
    })

    test('alasan kosong menahan tombolnya', async () => {
      setup(creditFixture(HELD_CREDIT_MOCK_IDS.latePayment), 'FAILED')
      expect(screen.getByRole('button', { name: 'Tolak kredit' })).toBeDisabled()
    })

    test('409 dari server dijelaskan dengan kalimat, bukan kode', async () => {
      const user = userEvent.setup()
      const credit = creditFixture(HELD_CREDIT_MOCK_IDS.latePayment)
      server.use(
        http.post(`/api/v1/held-credits/${credit.id}/resolve`, () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'CREDIT_NOT_HELD', message: 'CREDIT_NOT_HELD' },
            },
            { status: 409 }
          )
        )
      )
      setup(credit, 'FAILED')
      await user.type(screen.getByLabelText(/^Alasan/), 'pengirim bukan nasabah USDX')
      await user.click(screen.getByRole('button', { name: 'Tolak kredit' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/sudah menyelesaikannya/)
    })
  })

  describe('edge cases', () => {
    test('jawaban yang tidak dikenali DILEMPAR, bukan dianggap selesai', async () => {
      const user = userEvent.setup()
      const credit = creditFixture(HELD_CREDIT_MOCK_IDS.latePayment)
      server.use(
        http.post(`/api/v1/held-credits/${credit.id}/resolve`, () =>
          HttpResponse.json({ status: 'success', metadata: null, data: { entah: true } })
        )
      )
      setup(credit, 'FAILED')
      await user.type(screen.getByLabelText(/^Alasan/), 'pengirim bukan nasabah USDX')
      await user.click(screen.getByRole('button', { name: 'Tolak kredit' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/tidak dikenali/)
    })

    test('akibat TOLAK menyebut pengembalian dana yang manual', () => {
      setup(creditFixture(HELD_CREDIT_MOCK_IDS.latePayment), 'FAILED')
      expect(screen.getByTestId('akibat-resolve')).toHaveTextContent(
        /treasury yang mengembalikannya ke nasabah secara manual/
      )
    })
  })
})
