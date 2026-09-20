import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import UserDetailPage from '@/features/users/UserDetailPage'
import { renderWithProviders } from '@/test/test-utils'

// ─────────────────────────────────────────────────────────────────────────────
// § 4 P0-3 — tautan dari halaman nasabah ke transaksinya.
//
// `/transactions?userId=` SUDAH dihormati sejak USDX-206, dan komentarnya
// sendiri menyebut "e.g. arriving from a user detail page". Tidak pernah ada
// yang menautkannya, jadi operator yang menerima komplain "transaksi saya ke
// mana?" harus mencari nasabahnya, membuka detailnya, menemukan bahwa order
// konsumennya memang tidak ditampilkan di sana, lalu pindah menu dan menyaring
// manual.
// ─────────────────────────────────────────────────────────────────────────────

const USER_ID = 'usr_42'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function userDetail(over: Record<string, unknown> = {}) {
  return http.get(`/api/v1/users/${USER_ID}`, () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: {
        id: USER_ID,
        name: 'Alice Anderson',
        email: 'alice@example.com',
        phone: null,
        entityType: 'INDIVIDUAL',
        kycStatus: 'VERIFIED',
        suspended: false,
        notes: null,
        emailVerifiedAt: '2026-05-01T00:00:00Z',
        activationEmailFailedAt: null,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
        wallets: [],
        analytics: { totalMinted: '0', totalBurned: '0', totalTransactions: 0 },
        recentRequests: [],
        ...over,
      },
    }),
  )
}

function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/users/:id" element={<UserDetailPage />} />
    </Routes>,
    { initialEntries: [`/users/${USER_ID}`], authenticated: true },
  )
}

describe('UserDetailPage — tautan ke transaksi nasabah (P0-3)', () => {
  describe('positive', () => {
    test('menautkan ke /transactions?userId=<id> nasabah ini', async () => {
      server.use(userDetail())
      setup()
      const link = await screen.findByRole('link', { name: /lihat transaksi nasabah ini/i })
      expect(link).toHaveAttribute('href', `/transactions?userId=${USER_ID}`)
    })

    test('tautannya membawa id NASABAH INI, bukan id yang di-hardcode', async () => {
      server.use(
        http.get('/api/v1/users/usr_other', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: 'usr_other',
              name: 'Budi',
              email: 'budi@example.com',
              phone: null,
              entityType: 'INDIVIDUAL',
              kycStatus: 'PENDING',
              suspended: false,
              notes: null,
              emailVerifiedAt: null,
              activationEmailFailedAt: null,
              createdAt: '2026-05-01T00:00:00Z',
              updatedAt: '2026-05-01T00:00:00Z',
              wallets: [],
              analytics: { totalMinted: '0', totalBurned: '0', totalTransactions: 0 },
              recentRequests: [],
            },
          }),
        ),
      )
      renderWithProviders(
        <Routes>
          <Route path="/users/:id" element={<UserDetailPage />} />
        </Routes>,
        { initialEntries: ['/users/usr_other'], authenticated: true },
      )
      const link = await screen.findByRole('link', { name: /lihat transaksi nasabah ini/i })
      expect(link).toHaveAttribute('href', '/transactions?userId=usr_other')
    })
  })

  describe('edge cases', () => {
    test('tautannya NAVIGASI, bukan aksi — tidak ada tombol yang mengubah apa pun', async () => {
      // Batasan P0-2/P0-3: tautan mengirim operatornya, bukan perintahnya.
      // Tombol aksi di layar monitoring akan melewati gerbang peran dan audit
      // PII yang hidup di layar aslinya.
      server.use(userDetail())
      setup()
      const link = await screen.findByRole('link', { name: /lihat transaksi nasabah ini/i })
      expect(link.tagName).toBe('A')
      expect(
        screen.queryByRole('button', { name: /lihat transaksi nasabah ini/i }),
      ).not.toBeInTheDocument()
    })

    test('kartu "Permintaan OTC terbaru" tetap ada — tautannya menambah, bukan mengganti', async () => {
      // Kartu itu hanya memuat request OTC. Order KONSUMEN nasabah ini memang
      // tidak pernah tampil di halaman ini; itulah yang ditutup tautan di atas.
      server.use(userDetail())
      setup()
      expect(
        await screen.findByRole('heading', { name: /permintaan otc terbaru/i }),
      ).toBeInTheDocument()
    })
  })
})
