import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { APPROVAL_MOCK_IDS } from '@/mocks/data'
import ApprovalsPage from '@/features/approvals/ApprovalsPage'
import ApprovalDetailModal from '@/features/approvals/ApprovalDetailModal'
import { renderWithProviders } from '@/test/test-utils'

// Persetujuan Orang Kedua — `/api/v1/approvals` (USDX-486).
// Seed: stf_2 (MANAGER) mengusulkan pelepasan rem; sisanya diusulkan stf_4.
// Peran: stf_1 ADMIN · stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/persetujuan', staffId = 'stf_1') {
  return renderWithProviders(<ApprovalsPage />, { initialEntries: [path], staffId })
}

function openDetail(id: string, staffId: string) {
  return renderWithProviders(
    <ApprovalDetailModal approvalId={id} open onOpenChange={() => {}} />,
    { initialEntries: ['/persetujuan'], staffId }
  )
}

function recordListQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/approvals') seen.push(url.search)
  })
  return seen
}

describe('ApprovalsPage @ USDX-486', () => {
  describe('positive', () => {
    test('merender antrean, usulan terbaru dulu, dengan nama pengusul', async () => {
      const { container } = setup()
      // Dua baris memakai jenis usulan ini (satu menunggu, satu kedaluwarsa).
      expect(await screen.findAllByText('Lepas rem pencairan')).toHaveLength(2)
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(5)
      // Terbaru = pelepasan rem (18 menit lalu), diusulkan Linda Chen (stf_2).
      await waitFor(() => expect(within(rows[0]!).getByText('Linda Chen')).toBeInTheDocument())
      expect(within(rows[0]!).getByText('Tanpa nominal')).toBeInTheDocument()
    })

    test('nominal dirender penuh, bukan dibulatkan', async () => {
      setup()
      expect(await screen.findByText('Rp 24.750.000,00')).toBeInTheDocument()
    })

    test('sisa masa berlaku ditampilkan sebagai hitung mundur, dan yang mendesak ditandai', async () => {
      // Masa berlaku bukan hiasan: usulan "lepas rem" dari insiden tiga bulan
      // lalu tidak boleh masih bisa disetujui hari ini. Jadi ia tampil sebagai
      // hitung mundur, bukan satu stempel waktu lagi untuk dikurangi di kepala.
      const { container } = setup()
      await screen.findAllByText('Lepas rem pencairan')
      const pending = screen.getAllByText(/lagi$/)
      expect(pending.length).toBe(2)
      // Usulan pelepasan rem kedaluwarsa dalam 1 jam → ditandai mendesak.
      expect(container.querySelector('.text-warning')).not.toBeNull()
      // Usulan yang sudah diputus tidak punya hitung mundur sama sekali.
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })

    test('saringan dari URL dikirim ke server', async () => {
      const seen = recordListQueries()
      setup('/persetujuan?status=PENDING')
      await screen.findByText('Rp 24.750.000,00')
      await waitFor(() => expect(seen.some((q) => q.includes('status=PENDING'))).toBe(true))
      expect(screen.queryByText('Kedaluwarsa')).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('STAFF diberi tahu ia hanya bisa melihat', async () => {
      setup('/persetujuan', 'stf_4')
      await screen.findAllByText('Lepas rem pencairan')
      expect(screen.getByText('Hanya bisa melihat')).toBeInTheDocument()
    })

    test('DEVELOPER juga hanya bisa melihat — ia read-only di jalur uang', async () => {
      setup('/persetujuan', 'stf_3')
      await screen.findAllByText('Lepas rem pencairan')
      expect(screen.getByText('Hanya bisa melihat')).toBeInTheDocument()
    })

    test('nilai `status` yang bukan enum kontrak TIDAK dikirim', async () => {
      // `@IsEnum` di `ListApprovalsDto` menjawab 400, dan tautan basi tidak
      // boleh membuat antreannya terlihat rusak.
      const seen = recordListQueries()
      setup('/persetujuan?status=MUNGKIN')
      await screen.findAllByText('Lepas rem pencairan')
      expect(seen.every((q) => !q.includes('status='))).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('usulan APPROVED yang aksinya belum berjalan diangkat ke atas tabel', async () => {
      // Schema backend menyebut keadaan ini "WAJIB terlihat ops"; sebelum layar
      // ini ada, tidak ada yang pernah menayangkannya.
      setup()
      const banner = await screen.findByTestId('usulan-macet')
      expect(banner).toHaveTextContent(/1 usulan sudah disetujui tapi aksinya belum berjalan/)
      expect(banner).toHaveTextContent(/TIDAK\s+dikembalikan ke menunggu/)
    })

    test('antrean kosong menjelaskan dari mana usulan datang', async () => {
      server.use(
        http.get('/api/v1/approvals', () =>
          HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 20, total: 0 }, data: [] })
        )
      )
      setup()
      expect(await screen.findByText('Tidak ada usulan')).toBeInTheDocument()
    })
  })
})

describe('ApprovalDetailModal @ USDX-486', () => {
  describe('positive', () => {
    test('menerjemahkan payload jadi akibat, bukan nama kolom', async () => {
      openDetail(APPROVAL_MOCK_IDS.heldCreditPending, 'stf_1')
      expect(await screen.findByText(/TERIMA — uangnya diakui/)).toBeInTheDocument()
      expect(
        screen.getByText('Dicocokkan manual dengan rekening koran BNI 09.15, nama pengirim sama dengan pemilik order')
      ).toBeInTheDocument()
    })

    test('MANAGER lain mendapat kedua tombol putusan', async () => {
      openDetail(APPROVAL_MOCK_IDS.heldCreditPending, 'stf_2')
      expect(await screen.findByRole('button', { name: 'Setujui' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Tolak' })).toBeEnabled()
    })

    test('payload mentah DILIPAT ke Detail teknis, tidak dibuang', async () => {
      const user = userEvent.setup()
      openDetail(APPROVAL_MOCK_IDS.heldCreditPending, 'stf_1')
      await screen.findByText(/TERIMA — uangnya diakui/)
      // TERTUTUP = TIDAK TERLIHAT, bukan tidak ada di DOM. Sejak `DetailTeknis`
      // memakai `hidden="until-found"` isinya sengaja TETAP di DOM supaya Ctrl+F
      // menemukannya — jadi yang dijaga di sini keadaan yang benar-benar dialami
      // operator: ia tidak melihatnya sampai membukanya.
      expect(screen.getByTestId('usulan-payload-mentah')).not.toBeVisible()
      await user.click(screen.getByText('Detail teknis'))
      expect(await screen.findByTestId('usulan-payload-mentah')).toHaveTextContent('creditId')
    })
  })

  describe('negative', () => {
    test('PENGUSUL sendiri: tombol hilang dan ALASANNYA ditulis', async () => {
      // Tombol mati tanpa keterangan dibaca sebagai halaman rusak. Pagarnya
      // adalah POJK 4/2021 Penjelasan Pasal 5 — dan orang berhak tahu itu.
      openDetail(APPROVAL_MOCK_IDS.brakeReleasePending, 'stf_2')
      const locked = await screen.findByTestId('putusan-terkunci')
      expect(locked).toHaveTextContent(/Kamu yang mengusulkan ini/)
      expect(locked).toHaveTextContent(/Jejak Audit/)
      expect(screen.queryByRole('button', { name: 'Setujui' })).not.toBeInTheDocument()
    })

    test('STAFF: alasannya menyebut peran, bukan sekadar "tidak boleh"', async () => {
      // Usulan milik stf_2, supaya yang menguncinya PERAN — bukan larangan
      // menyetujui usulan sendiri, yang diperiksa lebih dulu.
      openDetail(APPROVAL_MOCK_IDS.brakeReleasePending, 'stf_4')
      expect(await screen.findByTestId('putusan-terkunci')).toHaveTextContent(
        /hanya untuk Manager dan Admin/
      )
    })

    test('usulan yang sudah diputus menjelaskan bahwa tidak ada keputusan kedua', async () => {
      openDetail(APPROVAL_MOCK_IDS.rejected, 'stf_1')
      expect(await screen.findByTestId('putusan-terkunci')).toHaveTextContent(
        /sudah diputuskan atau sudah lewat masa berlaku/
      )
    })
  })

  describe('edge cases', () => {
    test('usulan APPROVED yang macet menampilkan pesan kegagalan eksekusinya', async () => {
      openDetail(APPROVAL_MOCK_IDS.limitsStalled, 'stf_1')
      const banner = await screen.findByTestId('usulan-macet-detail')
      expect(banner).toHaveTextContent(/Sudah disetujui, aksinya belum berjalan/)
      expect(banner).toHaveTextContent(/PAYOUT_LIMITS_PAYLOAD_INVALID/)
    })

    test('bentuk payload yang tak dikenali DIPERINGATKAN dan ditampilkan mentah di badan utama', async () => {
      // Menyetujui sesuatu yang tidak bisa dibaca adalah persis kegagalan yang
      // mekanisme empat mata ini dibuat untuk mencegah — jadi JSON-nya berhenti
      // menjadi "detail" dan naik jadi bahan keputusan.
      server.use(
        http.get(`/api/v1/approvals/${APPROVAL_MOCK_IDS.heldCreditPending}`, () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: APPROVAL_MOCK_IDS.heldCreditPending,
              actionType: 'SESUATU_YANG_BARU',
              payload: { entah: 'apa' },
              amountIdr: null,
              status: 'PENDING',
              proposerStaffId: 'stf_4',
              proposedAt: '2026-09-20T00:00:00.000Z',
              expiresAt: '2036-09-21T00:00:00.000Z',
              approverStaffId: null,
              decidedAt: null,
              decisionReason: null,
              executedAt: null,
              executionError: null,
            },
          })
        )
      )
      openDetail(APPROVAL_MOCK_IDS.heldCreditPending, 'stf_1')
      expect(await screen.findByTestId('payload-tak-dikenali')).toHaveTextContent(
        /belum dikenali versi back office/
      )
      // Mentahnya terlihat TANPA harus membuka Detail teknis.
      expect(screen.getByTestId('usulan-payload-mentah')).toHaveTextContent('entah')
      // Tombolnya TIDAK dimatikan: membekukan antrean persetujuan karena satu
      // jenis aksi baru berarti uang berhenti bergerak tanpa ada yang memutuskan.
      expect(screen.getByRole('button', { name: 'Setujui' })).toBeEnabled()
    })
  })
})
