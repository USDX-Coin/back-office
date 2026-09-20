import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import ActivityLogPage from '@/features/activity-log/ActivityLogPage'
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
  })

  describe('negative', () => {
    test('TIDAK merender isian tanggal apa pun', async () => {
      // Pagar sungguhan, bukan kosmetik: `ListActivityLogsDto` tidak menerima
      // rentang waktu, dan ValidationPipe membuang parameter tak dikenal DIAM-
      // DIAM. Sebuah isian tanggal di sini akan mengembalikan SELURUH tabel
      // sambil tampak seperti hasil pencarian.
      const { container } = setup()
      await screen.findByText(/Rem pencairan ditarik/)
      expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0)
      expect(screen.queryByLabelText(/start date/i)).not.toBeInTheDocument()
      expect(screen.getByText(/rentang waktu/)).toBeInTheDocument()
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

    test('kode aksi yang belum punya terjemahan dirender APA ADANYA', async () => {
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
      expect(await screen.findByText('SESUATU_YANG_BELUM_ADA')).toBeInTheDocument()
      expect(screen.getByText('MODUL_BARU')).toBeInTheDocument()
      expect(screen.getByText('tidak tercatat')).toBeInTheDocument()
    })
  })
})
