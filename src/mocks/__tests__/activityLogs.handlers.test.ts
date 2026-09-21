import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import { findStaffById, issueMockJwt, resetMockData } from '@/mocks/handlers'
import type { ActivityLogEntry } from '@/features/activity-log/types'

// Cermin MSW untuk saringan rentang waktu `GET /api/v1/activity-logs`
// (branch backend `wisnubarata111/be-badge-antrean-dan-rentang-jejak`).
//
// Berkas ini ada karena test halamannya sengaja TIDAK bisa membuktikan ini:
// halaman hanya bisa memeriksa BENTUK permintaan yang dikirim. Kalau handler
// tiruan mengabaikan `from`/`to`, test halaman tetap hijau — dan itu persis
// kelas kegagalan yang saringan ini ada untuk mencegahnya di sisi server.
//
// Peran: stf_1 ADMIN (Jejak Audit ADMIN saja).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const AS_ADMIN: HeadersInit = { Authorization: `Bearer ${issueMockJwt(findStaffById('stf_1')!)}` }

async function list(query = ''): Promise<{
  status: number
  body: { data: ActivityLogEntry[]; metadata: { total: number } }
}> {
  const res = await fetch(`/api/v1/activity-logs${query}`, { headers: AS_ADMIN })
  return { status: res.status, body: await res.json() }
}

/** Seed berumur relatif terhadap "sekarang", jadi batasnya dihitung, bukan ditulis. */
function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

describe('GET /api/v1/activity-logs — saringan rentang waktu', () => {
  describe('positive', () => {
    test('tanpa rentang, seluruh seed terbaca', async () => {
      const { status, body } = await list('?take=100')
      expect(status).toBe(200)
      expect(body.metadata.total).toBeGreaterThan(0)
      expect(body.data.length).toBe(body.metadata.total)
    })

    test('`from` menyempitkan ke kejadian yang lebih baru', async () => {
      const semua = (await list('?take=100')).body.metadata.total
      // Seed terbarunya 12 menit lalu, yang tertua 1500 menit lalu.
      const { body } = await list(`?take=100&from=${encodeURIComponent(isoMinutesAgo(100))}`)
      expect(body.metadata.total).toBeGreaterThan(0)
      expect(body.metadata.total).toBeLessThan(semua)
      for (const row of body.data) {
        expect(Date.parse(row.createdAt)).toBeGreaterThanOrEqual(Date.now() - 101 * 60_000)
      }
    })

    test('`to` menyempitkan ke kejadian yang lebih lama', async () => {
      const semua = (await list('?take=100')).body.metadata.total
      const { body } = await list(`?take=100&to=${encodeURIComponent(isoMinutesAgo(100))}`)
      expect(body.metadata.total).toBeGreaterThan(0)
      expect(body.metadata.total).toBeLessThan(semua)
    })

    test('`from` dan `to` bersama mengapit satu jendela', async () => {
      const { body } = await list(
        `?take=100&from=${encodeURIComponent(isoMinutesAgo(150))}&to=${encodeURIComponent(isoMinutesAgo(50))}`
      )
      expect(body.metadata.total).toBeGreaterThan(0)
      for (const row of body.data) {
        const t = Date.parse(row.createdAt)
        expect(t).toBeGreaterThanOrEqual(Date.now() - 151 * 60_000)
        expect(t).toBeLessThanOrEqual(Date.now() - 49 * 60_000)
      }
    })
  })

  describe('negative', () => {
    test('bentuk yang bukan ISO-8601 dijawab 400, bukan dibuang diam-diam', async () => {
      // Inilah perbedaan yang membuat saringan ini aman dipasang di layar bukti
      // kepatuhan. Parameter yang DIBUANG diam-diam mengembalikan seluruh tabel
      // sambil tampak seperti hasil pencarian; 400 memberi tahu ada yang salah.
      expect((await list('?from=12-09-2026')).status).toBe(400)
      expect((await list('?to=kemarin')).status).toBe(400)
    })
  })

  describe('edge cases', () => {
    test('batasnya INKLUSIF di kedua ujung — bukan eksklusif', async () => {
      // Kalau batasnya eksklusif, menyaring "satu hari" akan membuang kejadian
      // pada milidetik pertama dan terakhirnya. Di jejak audit, baris itulah
      // yang biasanya sedang dicari.
      const semua = (await list('?take=100')).body.data
      const tertua = semua[semua.length - 1]!
      const terbaru = semua[0]!

      const persisSatu = await list(
        `?take=100&from=${encodeURIComponent(tertua.createdAt)}&to=${encodeURIComponent(tertua.createdAt)}`
      )
      expect(persisSatu.body.data.map((r) => r.id)).toContain(tertua.id)

      const seluruhnya = await list(
        `?take=100&from=${encodeURIComponent(tertua.createdAt)}&to=${encodeURIComponent(terbaru.createdAt)}`
      )
      expect(seluruhnya.body.metadata.total).toBe(semua.length)
    })

    test('rentang yang tidak memuat apa pun mengembalikan kosong, bukan seluruh tabel', async () => {
      // Kegagalan yang paling mudah luput: handler yang mengabaikan saringannya
      // menjawab SELURUH tabel di sini, dan angka itu terbaca sebagai hasil.
      const { body } = await list(
        `?take=100&from=${encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString())}`
      )
      expect(body.metadata.total).toBe(0)
      expect(body.data).toEqual([])
    })
  })
})
