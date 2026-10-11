import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import PayoutControlsPage from '@/features/payout-controls/PayoutControlsPage'
import { renderWithProviders } from '@/test/test-utils'

// Plafon Pencairan — `/api/v1/payout-controls`.
//   GET  /                 keempat peran   (sudah ada di backend@origin/dev)
//   POST /limits           MANAGER/ADMIN   (branch backend, BELUM merge)
//   GET  /limits/history   MANAGER/ADMIN   (branch backend, BELUM merge)
// Peran: stf_1 ADMIN · stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(staffId = 'stf_2') {
  return renderWithProviders(<PayoutControlsPage />, {
    initialEntries: ['/plafon-pencairan'],
    staffId,
  })
}

/** Audit Pengaturan (11 Okt 2026): form usulan di dialog dari tombol "Ubah plafon". */
async function openPlafonForm() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Ubah plafon' }))
  await screen.findByRole('dialog', { name: /usulkan perubahan plafon/i })
}

function captureLimitsBody() {
  const seen: unknown[] = []
  server.events.on('request:start', async ({ request }) => {
    if (!request.url.includes('/payout-controls/limits') || request.method !== 'POST') return
    seen.push(await request.clone().json())
  })
  return seen
}

describe('PayoutControlsPage @ plafon pencairan', () => {
  describe('positive', () => {
    test('menampilkan keadaan rem LEBIH DULU, lalu ketiga plafon', async () => {
      // Plafon yang masih berlaku di atas payout yang sedang MATI adalah dua
      // fakta yang kalau dipisah membuat orang salah membaca keduanya.
      setup()
      const rem = await screen.findByTestId('keadaan-rem')
      expect(rem).toHaveTextContent(/Terlepas/)
      // Dibaca dari KARTU keadaan, bukan dari seluruh halaman: pratinjau usulan
      // menampilkan angka yang sama dan akan membuat pencarian global ambigu.
      const kartu = rem.closest('div[class*="rounded-md"]')!.parentElement!
      expect(within(kartu).getByText('Rp 50.000.000,00')).toBeInTheDocument()
      expect(within(kartu).getByText('Rp 2.000.000.000,00')).toBeInTheDocument()
      expect(within(kartu).getByText('25 order per putaran')).toBeInTheDocument()
    })

    test('rem yang tertarik ditandai merah dan menyebut akibatnya', async () => {
      server.use(
        http.get('/api/v1/payout-controls', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              payoutsEnabled: false,
              maxPerTxIdr: '50000000.00',
              maxDailyIdr: null,
              maxBatchPerTick: null,
              updatedAt: '2026-09-20T00:00:00.000Z',
              updatedBy: 'stf_1',
            },
          })
        )
      )
      setup()
      expect(await screen.findByTestId('keadaan-rem')).toHaveTextContent(
        /Tertarik — tidak ada rupiah yang berangkat, berapa pun plafonnya/
      )
    })

    test('refetch yang GAGAL setelah kirim tidak menghapus kartu "menunggu orang kedua"', async () => {
      // Regresi yang lahir dari gerbang `isError` versi pertama, dan lebih berat
      // daripada cacat yang hendak ditutupnya.
      //
      // `useUpdatePayoutLimits.onSuccess` meng-invalidate `PAYOUT_CONTROLS_KEY`,
      // jadi SETIAP usulan yang berhasil memaksa satu GET ulang. Kalau GET itu
      // gagal, gerbang berbasis `isError` meng-unmount seluruh form — dan
      // bersamanya hilang kartu konfirmasi beserta tautan ke usulan yang BARU
      // SAJA TERCATAT di server.
      //
      // Operator lalu membaca "usulan dimatikan" untuk usulan yang sudah ada di
      // antrean, dan tindakan paling wajar berikutnya adalah mengirim ulang —
      // dua usulan untuk satu perubahan plafon, masing-masing menunggu orang
      // kedua. Produksi memakai `retry: 1`, jadi satu GET gagal sudah cukup.
      const user = userEvent.setup()
      let getCount = 0
      server.use(
        http.get('/api/v1/payout-controls', () => {
          getCount += 1
          // GET pertama sukses (baseline tiba), GET kedua — yang dipicu oleh
          // usulan yang BERHASIL — gagal.
          if (getCount > 1) {
            return HttpResponse.json(
              { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
              { status: 500 }
            )
          }
          return HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              payoutsEnabled: true,
              maxPerTxIdr: '50000000.00',
              maxDailyIdr: '2000000000.00',
              maxBatchPerTick: 25,
              updatedAt: '2026-09-20T02:00:00.000Z',
              updatedBy: 'stf_1',
            },
          })
        })
      )
      setup()
      await openPlafonForm()
      const perTx = await screen.findByLabelText(/Plafon per transaksi/)
      await waitFor(() => expect(perTx).toHaveValue('50000000.00'))
      await user.clear(perTx)
      await user.type(perTx, '75000000')
      await user.type(
        screen.getByLabelText(/^Alasan/),
        'Plafon dinaikkan untuk antrean pencairan akhir bulan'
      )
      await user.click(screen.getByRole('button', { name: 'Usulkan perubahan' }))

      // Kartu konfirmasi + tautannya WAJIB tetap ada.
      expect(await screen.findByTestId('plafon-menunggu-orang-kedua')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /buka usulannya/i })).toBeInTheDocument()
      // Dan layar TIDAK boleh berkata usulannya dimatikan.
      expect(screen.queryByText(/Usulan perubahan plafon dimatikan/)).not.toBeInTheDocument()
    })

    test('MANAGER mengusulkan plafon baru dan diberi tautan ke usulannya', async () => {
      const user = userEvent.setup()
      const body = captureLimitsBody()
      setup()
      await openPlafonForm()
      const perTx = await screen.findByLabelText(/Plafon per transaksi/)
      await waitFor(() => expect(perTx).toHaveValue('50000000.00'))

      await user.clear(perTx)
      await user.type(perTx, '75000000')
      await user.type(
        screen.getByLabelText(/^Alasan/),
        'Plafon dinaikkan untuk antrean pencairan akhir bulan'
      )
      await user.click(screen.getByRole('button', { name: 'Usulkan perubahan' }))

      await waitFor(() => expect(body).toHaveLength(1))
      // SNAPSHOT UTUH: ketiga plafon ikut, walau cuma satu yang disentuh.
      expect(body[0]).toEqual({
        maxPerTxIdr: '75000000',
        maxDailyIdr: '2000000000.00',
        maxBatchPerTick: 25,
        reason: 'Plafon dinaikkan untuk antrean pencairan akhir bulan',
      })

      const panel = await screen.findByTestId('plafon-menunggu-orang-kedua')
      expect(panel).toHaveTextContent(/Tidak ada satu plafon pun yang berubah/)
      expect(panel).toHaveTextContent(/Pengusul tidak boleh menjadi penyetujunya/)
      expect(screen.getByRole('button', { name: /Buka usulannya/ })).toBeInTheDocument()
    })

    test('pratinjau menunjukkan nilai SEBELUM → SESUDAH sebelum dikirim', async () => {
      const user = userEvent.setup()
      setup()
      await openPlafonForm()
      const perTx = await screen.findByLabelText(/Plafon per transaksi/)
      await waitFor(() => expect(perTx).toHaveValue('50000000.00'))
      await user.clear(perTx)
      await user.type(perTx, '75000000')
      const preview = screen.getByTestId('pratinjau-perubahan')
      expect(within(preview).getByText('Rp 50.000.000,00')).toBeInTheDocument()
      expect(within(preview).getByText('Rp 75.000.000,00')).toBeInTheDocument()
    })

    test('riwayat menampilkan alasan, sebelum → sesudah, pengusul dan penyetuju', async () => {
      // Sejak 11 Okt 2026 riwayat = tabel; isi lengkapnya di modal baris.
      const user = userEvent.setup()
      setup()
      expect(
        await screen.findByText(/Plafon per transaksi diturunkan setelah insiden payout ganda/)
      ).toBeInTheDocument()
      const rows = await screen.findAllByRole('button', { name: /^Buka perubahan plafon/ })
      await user.click(rows[0]!)
      const modal = await screen.findByTestId('plafon-riwayat-modal')
      expect(within(modal).getByText('Rp 100.000.000,00')).toBeInTheDocument()
      await waitFor(() => expect(within(modal).getByText('Sarah King')).toBeInTheDocument())
      expect(within(modal).getByText('Linda Chen')).toBeInTheDocument()
      expect(within(modal).getByRole('link', { name: /lihat usulan persetujuannya/i })).toBeInTheDocument()
      // ↓ pindah ke versi berikutnya tanpa menutup modal.
      await user.keyboard('{ArrowDown}')
      await waitFor(() =>
        expect(within(screen.getByTestId('plafon-riwayat-modal')).getByTestId('record-modal-position')).toHaveTextContent(/^2 dari/)
      )
    })
  })

  describe('negative', () => {
    test.each([
      ['STAFF', 'stf_4'],
      ['DEVELOPER', 'stf_3'],
    ])('%s melihat angkanya tapi tidak form maupun riwayat', async (_role, staffId) => {
      setup(staffId)
      // Keadaan rem tetap terbuka — itulah yang perlu dilihat cepat saat insiden.
      expect(await screen.findByTestId('keadaan-rem')).toBeInTheDocument()
      expect(screen.getByTestId('hanya-baca')).toHaveTextContent(/hanya untuk Manager dan Admin/)
      expect(screen.queryByRole('button', { name: 'Usulkan perubahan' })).not.toBeInTheDocument()
      expect(screen.queryByText('Riwayat perubahan plafon')).not.toBeInTheDocument()
    })

    test('usulan yang tidak mengubah apa pun ditahan', async () => {
      const user = userEvent.setup()
      setup()
      await openPlafonForm()
      await waitFor(() =>
        expect(screen.getByLabelText(/Plafon per transaksi/)).toHaveValue('50000000.00')
      )
      await user.type(screen.getByLabelText(/^Alasan/), 'alasan yang cukup panjang')
      expect(screen.getByRole('button', { name: 'Usulkan perubahan' })).toBeDisabled()
    })

    test('alasan kurang dari 10 karakter menahan tombolnya', async () => {
      const user = userEvent.setup()
      setup()
      await openPlafonForm()
      const perTx = await screen.findByLabelText(/Plafon per transaksi/)
      await waitFor(() => expect(perTx).toHaveValue('50000000.00'))
      await user.clear(perTx)
      await user.type(perTx, '75000000')
      await user.type(screen.getByLabelText(/^Alasan/), 'naik')
      expect(screen.getByRole('button', { name: 'Usulkan perubahan' })).toBeDisabled()
    })

    test('GET kontrol gagal → kartunya BILANG gagal, bukan skeleton selamanya', async () => {
      // Cabangnya dulu `isLoading || !data`, dan `!data` juga benar saat
      // permintaannya GAGAL — jadi kartunya terkunci skeleton: tanpa pesan, tanpa
      // "Coba lagi". Skeleton yang berputar terbaca "sebentar lagi muncul", bukan
      // "kami tidak tahu".
      //
      // Di layar ini bedanya bukan kosmetik: yang tidak terbaca adalah apakah REM
      // PENCAIRAN sedang tertarik atau terlepas. Operator yang menyimpulkan dari
      // kartu kosong menyimpulkan tentang uang yang sedang keluar.
      server.use(
        http.get('/api/v1/payout-controls', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 }
          )
        )
      )
      const { container } = setup()
      expect(await screen.findByText(/Keadaan rem dan plafon tidak terbaca/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument()
      // Dan skeleton-nya benar-benar HILANG — bukan pesan galat yang ditempel di
      // atas kartu yang masih berputar.
      expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0)
      // Keadaan rem TIDAK diklaim ke arah mana pun.
      expect(screen.queryByTestId('keadaan-rem')).not.toBeInTheDocument()
    })

    test('GET kontrol gagal → form usulan MATI, tidak mengarang baseline "Bawaan server"', async () => {
      // Badan permintaannya SNAPSHOT UTUH: mengisi satu isian saat GET mati
      // diam-diam mengusulkan reset dua plafon lain ke bawaan server. Dan tabel
      // SEBELUM → SESUDAH mengeja `null` sebagai "Bawaan server" — klaim faktual
      // ("tidak ada baris kontrol tersimpan") yang tidak pernah dibaca dari mana
      // pun. Orang kedua lalu menyetujui atas baseline karangan.
      //
      // Satu layar tidak boleh membantah dirinya sendiri: kartu di kiri sudah
      // bilang keadaannya tidak terbaca.
      server.use(
        http.get('/api/v1/payout-controls', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 }
          )
        )
      )
      setup()
      expect(await screen.findByText(/Usulan perubahan plafon dimatikan/)).toBeInTheDocument()
      // Form-nya benar-benar hilang: tidak ada isian alasan, tidak ada tombol usul.
      expect(screen.queryByLabelText(/^Alasan/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /usulkan perubahan/i })
      ).not.toBeInTheDocument()

      // "Bawaan server" yang TERSISA hanya boleh datang dari RIWAYAT — nilai yang
      // benar-benar pernah tercatat, dirender dengan coretan. Yang dilarang adalah
      // baseline KARANGAN di tabel SEBELUM → SESUDAH milik form, yang tidak pernah
      // dibaca dari mana pun. Keduanya mengeja kata yang sama; hanya satu yang
      // merupakan klaim tentang keadaan sekarang.
      for (const el of screen.queryAllByText('Bawaan server')) {
        expect(el.className).toContain('line-through')
      }
    })

    test('404 riwayat dijelaskan sebagai endpoint yang belum ada, bukan galat layar', async () => {
      // Sisi tulis + riwayat baru ada setelah perubahan backend yang menyertainya
      // naik. "Not Found" mentah di sini berakhir sebagai laporan bug salah alamat.
      server.use(
        http.get('/api/v1/payout-controls/limits/history', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'Cannot GET' } },
            { status: 404 }
          )
        )
      )
      setup()
      expect(await screen.findByTestId('riwayat-galat')).toHaveTextContent(
        /belum menyajikan endpoint plafon pencairan/
      )
    })
    test('tautan riwayat saat riwayat gagal dimuat bilang gagal, bukan "tidak ada di daftar ini"', async () => {
      server.use(
        http.get('/api/v1/payout-controls/limits/history', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'Cannot GET' } },
            { status: 404 }
          )
        )
      )
      renderWithProviders(<PayoutControlsPage />, {
        initialEntries: ['/plafon-pencairan/riwayat/ver_1'],
        staffId: 'stf_2',
      })
      const modal = await screen.findByTestId('plafon-riwayat-modal')
      expect(await within(modal).findByRole('heading', { name: 'Riwayat gagal dimuat' })).toBeInTheDocument()
      expect(modal).not.toHaveTextContent(/tidak ada di daftar ini/)
    })
  })

  describe('edge cases', () => {
    test('tanpa baris kontrol: "Bawaan server", dan BUKAN tanggal 1970', async () => {
      server.use(
        http.get('/api/v1/payout-controls', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              payoutsEnabled: true,
              maxPerTxIdr: null,
              maxDailyIdr: null,
              maxBatchPerTick: null,
              updatedAt: '1970-01-01T00:00:00.000Z',
              updatedBy: null,
            },
          })
        )
      )
      setup()
      await screen.findByTestId('keadaan-rem')
      expect(screen.getAllByText('Bawaan server').length).toBeGreaterThanOrEqual(3)
      expect(screen.getByText(/Belum pernah ada baris kontrol/)).toBeInTheDocument()
      // Operator TIDAK MEMBACA tanggal 1970 di kartunya. Nilai mentah
      // `updatedAt` milik server tetap ada — terlipat di "Detail teknis", yang
      // sejak memakai `hidden="until-found"` memang tinggal di DOM supaya Ctrl+F
      // menemukannya. Jadi yang dikunci dua hal sekaligus: tidak terlihat, dan
      // tidak dibuang.
      const epoch = screen.getByText(/1970-01-01/)
      expect(epoch).not.toBeVisible()
      expect(epoch.closest('[data-testid="detail-teknis"]')).not.toBeNull()
    })

    test('mengosongkan isian berarti "kembali ke bawaan server", dan dikirim sebagai null', async () => {
      const user = userEvent.setup()
      const body = captureLimitsBody()
      setup()
      await openPlafonForm()
      const daily = await screen.findByLabelText(/Plafon per hari/)
      await waitFor(() => expect(daily).toHaveValue('2000000000.00'))
      await user.clear(daily)
      await user.type(screen.getByLabelText(/^Alasan/), 'Kembalikan plafon harian ke bawaan server')
      await user.click(screen.getByRole('button', { name: 'Usulkan perubahan' }))
      await waitFor(() => expect(body).toHaveLength(1))
      expect((body[0] as { maxDailyIdr: unknown }).maxDailyIdr).toBeNull()
    })
  })
})
