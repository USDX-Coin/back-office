import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { HELD_CREDIT_MOCK_IDS } from '@/mocks/data'
import HeldCreditsPage from '@/features/held-credits/HeldCreditsPage'
import HeldCreditDetailModal from '@/features/held-credits/HeldCreditDetailModal'
import { renderWithProviders } from '@/test/test-utils'

// Mint Bermasalah — `/api/v1/held-credits` (USDX-341/342 + USDX-486).
// Peran: stf_1 ADMIN · stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/mint-bermasalah', staffId = 'stf_2') {
  return renderWithProviders(<HeldCreditsPage />, { initialEntries: [path], staffId })
}

function openDetail(creditId: string, staffId = 'stf_2') {
  return renderWithProviders(
    <HeldCreditDetailModal creditId={creditId} open onOpenChange={() => {}} />,
    { initialEntries: ['/mint-bermasalah'], staffId }
  )
}

describe('HeldCreditsPage @ USDX-342', () => {
  describe('positive', () => {
    test('merender antrean terbuka, terlama dulu, dengan nominal PENUH', async () => {
      const { container } = setup()
      expect(await screen.findByText('Pintu Kripto / cust-88120')).toBeInTheDocument()
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(3)
      // Terlama = DurianPay (510 menit), terbaru = kredit tanpa order (75 menit).
      expect(within(rows[0]!).getByText('Rp 5.000.000,00')).toBeInTheDocument()
      expect(within(rows[2]!).getByText('Rp 24.750.000,00')).toBeInTheDocument()
    })

    test('menerjemahkan sebab tertahan dan menyimpan kodenya di title', async () => {
      const { container } = setup()
      await screen.findByText('Pintu Kripto / cust-88120')
      expect(screen.getByText('Tidak ada order dengan nominal ini')).toBeInTheDocument()
      // Kode mesinnya TIDAK hilang gara-gara diterjemahkan — ia ikut di `title`,
      // karena itu yang dikutip operator saat melapor ke tim teknis.
      expect(
        container.querySelector(
          '[title="Tidak ada order dengan nominal ini (NO_MATCHING_ORDER)"]'
        )
      ).not.toBeNull()
    })

    test('menunjukkan SELISIH antara yang ditagihkan dan yang masuk', async () => {
      // Justru selisih inilah sebab kredit tertahan; menyembunyikannya membuat
      // operator harus mengurangi sendiri dua angka di dua kolom.
      setup()
      expect(await screen.findByText('kurang Rp 250.000,00')).toBeInTheDocument()
    })

    test('kredit tanpa order dinyatakan sebagai keputusan ops, bukan sel kosong', async () => {
      setup()
      await screen.findByText('Pintu Kripto / cust-88120')
      expect(screen.getByText('Tidak ada — ops menentukan')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('DEVELOPER diberi tahu ia hanya bisa melihat', async () => {
      setup('/mint-bermasalah', 'stf_3')
      await screen.findByText('Pintu Kripto / cust-88120')
      expect(screen.getByText('Hanya bisa melihat')).toBeInTheDocument()
    })

    test('MANAGER tidak diberi penanda read-only', async () => {
      setup()
      await screen.findByText('Pintu Kripto / cust-88120')
      expect(screen.queryByText('Hanya bisa melihat')).not.toBeInTheDocument()
    })

    test('TIDAK merender saringan apa pun — kontraknya cuma page + take', async () => {
      // `ListHeldCreditsDto` tidak menerima saringan; memasangnya berarti
      // menulis parameter yang dibuang diam-diam ValidationPipe, dan antrean
      // akan tampak menyusut padahal server mengirim halaman yang sama.
      const { container } = setup()
      await screen.findByText('Pintu Kripto / cust-88120')
      expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0)
      expect(screen.queryByRole('button', { name: /^filter/i })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/^search$/i)).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('sebab tertahan yang belum diterjemahkan: "Belum dikenali", kodenya di title (tanpa enum mentah)', async () => {
      server.use(
        http.get('/api/v1/held-credits', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 10, total: 1 },
            data: [
              {
                id: '019f7a01-0341-7c31-9b2d-0000000000aa',
                source: 'BNI',
                heldReason: 'SEBAB_YANG_BELUM_ADA',
                receivedAmountIdr: null,
                receivedAmountRaw: '1234567.891',
                accountFromTo: null,
                senderName: null,
                collectionAccountNo: null,
                journalNum: null,
                receivedAt: '2026-09-20T02:00:00.000Z',
                order: null,
              },
            ],
          })
        )
      )
      setup()
      expect(await screen.findByText('Belum dikenali')).toHaveAttribute('title', 'SEBAB_YANG_BELUM_ADA')
      expect(screen.queryByText('SEBAB_YANG_BELUM_ADA')).not.toBeInTheDocument()
      // Nominal yang BUKAN rupiah bulat tetap dirender apa adanya — nilai ganjil
      // itu justru yang paling sering jadi sebab kredit tertahan.
      expect(screen.getByText('Rp 1234567.891 (bukan rupiah bulat)')).toBeInTheDocument()
      expect(screen.getByText('tidak disebut penyedia')).toBeInTheDocument()
    })

    test('antrean kosong menjelaskan artinya, bukan sekadar "tidak ada data"', async () => {
      server.use(
        http.get('/api/v1/held-credits', () =>
          HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 10, total: 0 }, data: [] })
        )
      )
      setup()
      expect(await screen.findByText('Tidak ada mint bermasalah')).toBeInTheDocument()
    })
  })
})

describe('HeldCreditDetailModal @ USDX-342', () => {
  describe('positive', () => {
    test('DEVELOPER tidak mendapat tombol, dan diberi tahu kenapa', async () => {
      openDetail(HELD_CREDIT_MOCK_IDS.latePayment, 'stf_3')
      await screen.findByText('Rina Susanti')
      expect(screen.queryByRole('button', { name: /Terima/ })).not.toBeInTheDocument()
      expect(screen.getByText(/read-only pada jalur uang/)).toBeInTheDocument()
    })

    test('nilai mentah notifikasi bank DILIPAT, bukan dibuang', async () => {
      const user = userEvent.setup()
      openDetail(HELD_CREDIT_MOCK_IDS.latePayment)
      await screen.findByText('Rina Susanti')
      // TERTUTUP = TIDAK TERLIHAT, bukan tidak ada di DOM. Sejak `DetailTeknis`
      // memakai `hidden="until-found"` isinya sengaja TETAP di DOM supaya Ctrl+F
      // menemukannya — jadi yang dijaga di sini keadaan yang benar-benar dialami
      // operator: ia tidak melihatnya sampai membukanya.
      expect(screen.getByTestId('notif-raw')).not.toBeVisible()
      await user.click(screen.getByText('Detail teknis'))
      expect(await screen.findByTestId('notif-raw')).toHaveTextContent('884190')
      expect(screen.getByText('bni-4f2c1a90-2')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('kredit tanpa order memperingatkan bahwa keputusannya SELALU empat mata', async () => {
      openDetail(HELD_CREDIT_MOCK_IDS.noMatch)
      expect(
        await screen.findByText(/SELALU menuntut persetujuan staf lain, berapa pun nominalnya/)
      ).toBeInTheDocument()
    })

    test('kredit DurianPay menjelaskan kenapa jejak keputusannya tidak ada', async () => {
      openDetail(HELD_CREDIT_MOCK_IDS.durianpayMismatch)
      await screen.findByText('Pintu Kripto / cust-88120')
      expect(screen.getByTestId('residu-durianpay')).toHaveTextContent(/tidak menyimpan kolom resolusi/)
    })

    test('kredit yang tidak ada dijawab dengan kalimat, bukan dialog kosong', async () => {
      openDetail('019f7a01-0341-7c31-9b2d-0000000000ff')
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/tautannya sudah basi/)
      )
    })
  })
})
