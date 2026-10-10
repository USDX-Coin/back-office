import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { Route, Routes, useLocation } from 'react-router'
import ActivityLogPage from '@/features/activity-log/ActivityLogPage'
import { ACTIVITY_LOG_MOCK_IDS } from '@/mocks/data'
import { renderWithProviders } from '@/test/test-utils'

// Jejak Audit — `GET /api/v1/activity-logs` (ADMIN saja). Handler MSW bawaan
// menyajikan 8 baris seed. Peran: stf_1 ADMIN · stf_2 MANAGER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/jejak-audit', staffId = 'stf_1') {
  return renderWithProviders(<ActivityLogPage />, { initialEntries: [path], staffId })
}

function recordListQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/activity-logs') seen.push(url.search)
  })
  return seen
}

describe('ActivityLogPage @ jejak audit', () => {
  describe('positive', () => {
    test('merender jejak terbaru dulu, dengan NAMA aktor bukan UUID', async () => {
      // Endpoint-nya hanya mengirim `actorStaffId`. Layar yang menjawab "siapa"
      // dengan sebuah UUID tidak menjawab apa pun, jadi nama diambil dari
      // direktori staf (`GET /api/v1/staff`, tanpa `@Roles` di controller-nya).
      const { container } = setup()
      expect(await screen.findByText(/Percobaan menyetujui usulan sendiri/)).toBeInTheDocument()
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(8)
      await waitFor(() =>
        expect(within(rows[0]!).getByText('Linda Chen')).toBeInTheDocument()
      )
      expect(within(rows[0]!).getByText('Gagal')).toBeInTheDocument()
      expect(within(rows[0]!).getByText('103.28.14.77')).toBeInTheDocument()
    })

    test('menerjemahkan aksi ter-intercept jadi kata kerja + jalur', async () => {
      setup()
      expect(await screen.findByText('/api/v1/kyc/:id/approve')).toBeInTheDocument()
      expect(screen.getAllByText('Buat / jalankan').length).toBeGreaterThan(0)
    })

    test('menerjemahkan kelompok objek, dan tetap menyimpan kodenya di title', async () => {
      const { container } = setup()
      await screen.findByText(/Rem pencairan ditarik/)
      const cell = container.querySelector('[title="PAYOUT_CONTROLS"]')
      expect(cell).not.toBeNull()
      expect(cell!.textContent).toBe('Plafon & rem pencairan')
    })

    test('mengirim saringan dari URL apa adanya — pencocokannya PERSIS di server', async () => {
      const seen = recordListQueries()
      setup('/jejak-audit?outcome=FAILED&resourceType=KYC')
      expect(await screen.findByText('Peran tak berwenang')).toBeInTheDocument()
      await waitFor(() =>
        expect(seen.some((q) => q.includes('outcome=FAILED') && q.includes('resourceType=KYC'))).toBe(true)
      )
      expect(screen.queryByText(/Rem pencairan ditarik/)).not.toBeInTheDocument()
    })

    test('saringan aktor memakai id staf dan menyempitkan hasilnya', async () => {
      setup('/jejak-audit?actorStaffId=stf_2')
      await screen.findByText(/Rem pencairan ditarik/)
      expect(screen.queryByText(/Login gagal/)).not.toBeInTheDocument()
    })

    test('rentang tanggal dikirim sebagai instan WIB, inklusif di kedua ujung', async () => {
      // Pertanyaan pemeriksa selalu berbentuk tanggal ("apa yang terjadi 12
      // September"). Jebakannya zona waktu: `2026-09-12` telanjang dibaca server
      // sebagai 07:00 WIB, jadi tujuh jam kejadian pagi hilang — tanpa satu pun
      // tanda, sambil tampak seperti pencarian yang berhasil.
      //
      // Batas atas `23:59:59.999` karena backend membandingkan `lte`; memakai
      // `T00:00:00` hari berikutnya akan memasukkan satu milidetik yang bukan
      // milik rentangnya.
      // Sengaja TIDAK menunggu sebuah baris muncul: seed tiruan berumur relatif
      // terhadap "sekarang", jadi tanggal tetap apa pun akan mengosongkan tabel.
      // Yang diuji di sini BENTUK PERMINTAANNYA; bahwa handler benar-benar
      // menyaringnya diuji di `mocks/__tests__/activityLogs.handlers.test.ts`.
      const seen = recordListQueries()
      setup('/jejak-audit?from=2026-09-12&to=2026-09-12')
      await waitFor(() =>
        expect(
          seen.some(
            (q) =>
              q.includes(`from=${encodeURIComponent('2026-09-12T00:00:00+07:00')}`) &&
              q.includes(`to=${encodeURIComponent('2026-09-12T23:59:59.999+07:00')}`)
          )
        ).toBe(true)
      )
    })
  })

  describe('negative', () => {
    test('TIDAK merender isian id objek — server masih membuangnya diam-diam', async () => {
      // Pagar sungguhan, bukan kosmetik. `ListActivityLogsDto` menerima
      // `from`/`to` sekarang, tapi TIDAK `resourceId`, dan ValidationPipe
      // membuang parameter tak dikenal DIAM-DIAM. Isian id objek di sini akan
      // mengembalikan SELURUH tabel sambil tampak seperti hasil pencarian —
      // di layar yang dibuka justru saat pemeriksa bertanya.
      //
      // Yang dikunci bentuk POSITIF dan NEGATIF sekaligus: rentang tanggal ADA
      // (dua isian), id objek TIDAK ADA. Test yang cuma menghitung isian tanggal
      // akan hijau kalau suatu saat isian id objek ikut dipasang diam-diam.
      const user = userEvent.setup()
      setup()
      await screen.findByText(/Rem pencairan ditarik/)

      // Isiannya hidup di dalam popover Filter, jadi harus dibuka dulu —
      // memeriksanya tanpa membuka akan menghitung nol untuk dua sebab yang
      // berbeda, dan test yang tidak bisa membedakan keduanya tidak menjaga apa pun.
      await user.click(screen.getByRole('button', { name: /filter/i }))
      const popover = await screen.findByRole('dialog')
      expect(popover.querySelectorAll('input[type="date"]')).toHaveLength(2)
      expect(within(popover).queryByLabelText(/id objek/i)).not.toBeInTheDocument()

      // Dan cara kerjanya tetap tertulis di layar, di luar popover — sebagai
      // petunjuk untuk operator, bukan catatan tentang server.
      expect(screen.getByText(/Untuk menelusuri satu data tertentu/)).toBeInTheDocument()
    })

    test('rentang TERBALIK ditolak di layar, bukan dikirim lalu dijawab nol baris', async () => {
      // `?from=2026-09-30&to=2026-09-01` dulu dikirim apa adanya. Server menjawab
      // nol baris, dan di layar bukti kepatuhan nol baris terbaca "tidak ada
      // jejaknya" — kesimpulan yang salah dari isian yang salah, tanpa satu pun
      // tanda bahwa yang keliru adalah tanggalnya.
      //
      // Aturannya sudah ada di repo ini (`lib/dateRange.ts`, dipakai `/reports/*`
      // dan `/bni-accounts`); yang kurang cuma memasangnya di popover saringan.
      const user = userEvent.setup()
      setup()
      await screen.findByText(/Rem pencairan ditarik/)
      await user.click(screen.getByRole('button', { name: /filter/i }))
      const popover = await screen.findByRole('dialog')

      // Dua tanggal LAMPAU, supaya yang diuji benar-benar URUTANNYA — tanggal
      // masa depan ditolak lebih dulu oleh aturan yang berbeda, dan test yang
      // memakainya akan hijau karena alasan yang salah.
      const [mulai, akhir] = [...popover.querySelectorAll<HTMLInputElement>('input[type="date"]')]
      await user.type(mulai!, '2026-08-30')
      await user.type(akhir!, '2026-08-01')

      expect(await within(popover).findByRole('alert')).toHaveTextContent(
        /Tanggal mulai harus sebelum atau sama dengan tanggal akhir/
      )
      // Dan tombolnya MATI — pesan tanpa gerbang tetap mengizinkan permintaan
      // yang hanya bisa menjawab nol baris.
      expect(within(popover).getByRole('button', { name: /^terapkan$/i })).toBeDisabled()
    })

    test('tanggal MASA DEPAN juga ditolak, bukan cuma urutan terbalik', async () => {
      // Jejak audit mencatat yang SUDAH terjadi. Rentang yang berakhir di masa
      // depan hanya bisa menjawab nol baris untuk bagian itu — dan di layar bukti
      // kepatuhan, nol baris terbaca "tidak ada jejaknya".
      //
      // `max` pada `<input type="date">` cuma petunjuk kalender, bukan gerbang:
      // nilai yang datang dari URL tidak pernah melewatinya.
      const user = userEvent.setup()
      setup()
      await screen.findByText(/Rem pencairan ditarik/)
      await user.click(screen.getByRole('button', { name: /filter/i }))
      const popover = await screen.findByRole('dialog')

      const [mulai, akhir] = [...popover.querySelectorAll<HTMLInputElement>('input[type="date"]')]
      await user.type(mulai!, '2030-01-01')
      await user.type(akhir!, '2030-12-31')

      expect(await within(popover).findByRole('alert')).toHaveTextContent(
        /tidak boleh melewati hari ini/i
      )
      expect(within(popover).getByRole('button', { name: /^terapkan$/i })).toBeDisabled()
    })

    test.each([
      ['terbalik', '?from=2026-08-30&to=2026-08-01', /mulai harus sebelum/i],
      ['masa depan', '?from=2030-01-01&to=2030-12-31', /melewati hari ini/i],
      ['tanggal mustahil', '?from=2026-02-31&to=2026-02-31', /tidak ada di kalender/i],
    ])(
      'rentang %s dari URL: tidak dikirim, DAN layar bilang kenapa',
      async (_nama, query, pesan) => {
        // Gerbang yang cuma hidup di popover tidak pernah dilewati tautan lama,
        // bookmark, atau hasil salin-tempel — dan justru lewat situlah orang
        // membuka layar bukti kepatuhan.
        //
        // Diam saja tidak cukup: tabel biasa dengan chip tanggal terbaca sebagai
        // "tidak ada jejaknya pada tanggal itu", kesimpulan yang salah dari
        // tautan yang salah.
        const seen = recordListQueries()
        setup(`/jejak-audit${query}`)
        await screen.findByText(/Rem pencairan ditarik/)

        expect(seen.every((q) => !q.includes('from=') && !q.includes('to='))).toBe(true)
        expect(await screen.findByTestId('jejak-audit-rentang-bermasalah')).toHaveTextContent(pesan)
      }
    )

    test('nilai tanggal yang bukan YYYY-MM-DD TIDAK dikirim', async () => {
      // Sama seperti perlakuan `outcome`: tautan basi tidak boleh membuat
      // jejaknya terlihat rusak. `@IsISO8601()` akan menjawab 400 untuk bentuk
      // ini, jadi yang benar adalah tidak mengirimnya sama sekali.
      const seen = recordListQueries()
      setup('/jejak-audit?from=12-09-2026&to=kemarin')
      await screen.findByText(/Rem pencairan ditarik/)
      expect(seen.every((q) => !q.includes('from=') && !q.includes('to='))).toBe(true)
    })

    test('nilai `outcome` yang bukan enum kontrak TIDAK dikirim', async () => {
      const seen = recordListQueries()
      setup('/jejak-audit?outcome=MUNGKIN')
      await screen.findByText(/Rem pencairan ditarik/)
      expect(seen.every((q) => !q.includes('outcome='))).toBe(true)
    })

    test('direktori staf yang gagal dimuat tidak menghapus buktinya — id tetap terbaca', async () => {
      server.use(
        http.get('/api/v1/staff', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 }
          )
        )
      )
      setup()
      await screen.findByText(/Rem pencairan ditarik/)
      await waitFor(() =>
        expect(screen.getByText(/Nama staf gagal dimuat/)).toBeInTheDocument()
      )
      expect(screen.queryByText('Linda Chen')).not.toBeInTheDocument()
    })

    test('galat daftar merender keadaan galat, bukan tabel kosong yang menenangkan', async () => {
      // "Belum ada jejak" pada sistem yang sedang dipakai adalah kalimat yang
      // menenangkan pemeriksa atas dasar yang salah: yang terjadi bukan tabel
      // kosong, melainkan permintaan yang gagal.
      server.use(
        http.get('/api/v1/activity-logs', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 }
          )
        )
      )
      setup()
      // Judul default `TableErrorState` (`TableErrorState.tsx:13`), dicocokkan
      // UTUH dan bukan sekadar "gagal dimuat".
      //
      // Pencocokan longgar sempat dipakai saat menggabungkan cabang bahasa, dan
      // itu keliru: halaman ini juga mencetak "Nama staf gagal dimuat" saat
      // direktori staf gagal (`ActivityLogPage.tsx:406`). Keduanya berbagi satu
      // origin, jadi backend yang mati menjatuhkan dua-duanya — dan test longgar
      // akan tetap hijau kalau suatu saat tabelnya jatuh ke keadaan KOSONG
      // sementara baris kecil itu tetap muncul. Tabel kosong yang menenangkan di
      // layar bukti kepatuhan membuat pemeriksa menyimpulkan tidak ada jejaknya.
      expect(await screen.findByText(/Data ini gagal dimuat/i)).toBeInTheDocument()
      expect(screen.queryByText(/Belum ada jejak/)).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('baris tanpa aktor tetap dirender, tidak dibuang', async () => {
      // Login gagal sebelum identitas diketahui tidak punya staf maupun nasabah.
      setup('/jejak-audit?action=AUTH_LOGIN_FAILED')
      expect(await screen.findByText('Login gagal')).toBeInTheDocument()
      expect(screen.getByText('tanpa aktor')).toBeInTheDocument()
    })

    test('aktor nasabah ditandai sebagai nasabah, bukan disamakan dengan staf', async () => {
      setup('/jejak-audit?action=AUTH_LOGOUT')
      expect(await screen.findByText('Logout')).toBeInTheDocument()
      expect(screen.getByText('Nasabah')).toBeInTheDocument()
    })

    test('kode aksi/objek tanpa terjemahan: label manusia, kodenya di title (tanpa enum mentah)', async () => {
      server.use(
        http.get('/api/v1/activity-logs', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 20, total: 1 },
            data: [
              {
                id: 'x1',
                actorStaffId: null,
                actorUserId: null,
                action: 'SESUATU_YANG_BELUM_ADA',
                resourceType: 'MODUL_BARU',
                resourceId: null,
                metadata: null,
                ipAddress: null,
                outcome: 'SUCCESS',
                httpStatus: 200,
                createdAt: '2026-09-20T03:00:00.000Z',
              },
            ],
          })
        )
      )
      setup()
      expect(await screen.findByText('Aksi belum dikenali')).toHaveAttribute('title', 'SESUATU_YANG_BELUM_ADA')
      expect(screen.getByText('Belum dikenali')).toHaveAttribute('title', 'MODUL_BARU')
      expect(screen.queryByText('SESUATU_YANG_BELUM_ADA')).not.toBeInTheDocument()
      expect(screen.getByText('tidak tercatat')).toBeInTheDocument()
    })
  })
})

describe('ActivityLogPage — modal detail ber-URL (deep link + ↑/↓)', () => {
  function LocationProbe() {
    const loc = useLocation()
    return <div data-testid="lokasi">{loc.pathname + loc.search}</div>
  }

  function setupRoutes(path: string) {
    return renderWithProviders(
      <>
        <Routes>
          <Route path="/jejak-audit" element={<ActivityLogPage />} />
          <Route path="/jejak-audit/:id" element={<ActivityLogPage />} />
        </Routes>
        <LocationProbe />
      </>,
      { initialEntries: [path], staffId: 'stf_1' },
    )
  }

  describe('positive', () => {
    test('klik baris membuka modal di /jejak-audit/:id dengan saringan tetap di query', async () => {
      const user = userEvent.setup()
      setupRoutes('/jejak-audit?outcome=FAILED')
      const row = (await screen.findAllByRole('button', { name: /^jejak /i }))[0]!
      await user.click(row)
      const modal = await screen.findByTestId('jejak-modal')
      expect(screen.getByTestId('lokasi').textContent).toMatch(/^\/jejak-audit\/[^?]+\?outcome=FAILED$/)
      expect(within(modal).getByTestId('record-modal-position')).toHaveTextContent(/^1 dari \d+$/)
    })

    test('tautan langsung membuka baris yang sama dari muatan dingin, lalu ↓ pindah tanpa menutup', async () => {
      const user = userEvent.setup()
      setupRoutes(`/jejak-audit/${ACTIVITY_LOG_MOCK_IDS.selfApprovalBlocked}`)
      const modal = await screen.findByTestId('jejak-modal')
      await waitFor(() => expect(within(modal).getByTestId('record-modal-position')).toHaveTextContent('1 dari 8'))
      await user.keyboard('{ArrowDown}')
      await waitFor(() =>
        expect(within(screen.getByTestId('jejak-modal')).getByTestId('record-modal-position')).toHaveTextContent(
          '2 dari 8',
        ),
      )
      expect(screen.getByTestId('lokasi').textContent).not.toContain(ACTIVITY_LOG_MOCK_IDS.selfApprovalBlocked)
      await user.keyboard('{ArrowUp}')
      await waitFor(() =>
        expect(screen.getByTestId('lokasi').textContent).toContain(ACTIVITY_LOG_MOCK_IDS.selfApprovalBlocked),
      )
    })
  })

  describe('negative', () => {
    test('id yang tidak ada di halaman ini dikatakan terus terang, bukan modal kosong', async () => {
      setupRoutes('/jejak-audit/tidak-ada-di-halaman-ini')
      const modal = await screen.findByTestId('jejak-modal')
      expect(await within(modal).findByRole('heading', { name: 'Jejak tidak ada di halaman ini' })).toBeInTheDocument()
      expect(within(modal).queryByTestId('record-modal-position')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('"Saring aksi ini" menutup modal dan kembali ke daftar tersaring', async () => {
      const user = userEvent.setup()
      setupRoutes(`/jejak-audit/${ACTIVITY_LOG_MOCK_IDS.brakePulled}`)
      const modal = await screen.findByTestId('jejak-modal')
      await user.click(await within(modal).findByRole('button', { name: /saring aksi ini/i }))
      await waitFor(() => expect(screen.queryByTestId('jejak-modal')).not.toBeInTheDocument())
      expect(screen.getByTestId('lokasi').textContent).toMatch(/^\/jejak-audit\?action=/)
    })
  })
})
