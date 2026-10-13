import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { QUEUE_COUNTS_KEY } from '@/features/queue-counts/hooks'
import { useResolveHeldCredit } from '@/features/held-credits/hooks'
import { useDecideApproval } from '@/features/approvals/hooks'

// ─────────────────────────────────────────────────────────────────────────────
// Badge sidebar HARUS di-invalidate oleh aksi yang mengubah antreannya.
//
// Kenapa berkas ini ada: `Sidebar` dirender tanpa syarat di `MainLayout`, jadi ia
// TIDAK PERNAH unmount selama sesi. `useQueueCounts` memakai
// `refetchOnWindowFocus: false`, dan `staleTime` hanya berlaku saat mount/fokus —
// ia bukan timer. Tanpa invalidasi eksplisit, angkanya membeku sampai halaman
// di-reload: operator menuntaskan kredit tertahan terakhir dan badge "(3)" tetap
// menempel.
//
// Backend menulis peringatan ini sendiri di `approval-queue.ts`: "Badge yang
// tidak pernah bisa dikosongkan adalah badge yang berhenti dibaca."
//
// Diuji di tingkat HOOK, bukan halaman: yang dijaga adalah kontraknya
// (`onSuccess` menyentuh kunci itu), dan itu berlaku untuk pemanggil mana pun —
// termasuk yang belum ditulis.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

function siapkan() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, spy, wrapper }
}

type SpyInvalidate = { mock: { calls: unknown[][] } }

/** Apakah `invalidateQueries` pernah dipanggil untuk kunci badge? */
function menyentuhBadge(spy: SpyInvalidate): boolean {
  return spy.mock.calls.some((c: unknown[]) => {
    const key = (c[0] as { queryKey?: unknown } | undefined)?.queryKey
    return Array.isArray(key) && key[0] === QUEUE_COUNTS_KEY[0]
  })
}

describe('invalidasi badge antrean', () => {
  describe('positive', () => {
    test('menuntaskan kredit tertahan meng-invalidate hitungan badge', async () => {
      server.use(
        http.post('*/api/v1/held-credits/:id/resolve', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            // Bentuk yang `interpretResolveResponse` kenali sebagai SUDAH
            // dieksekusi (`creditId` + `resolution`) — bukan yang menunggu
            // orang kedua.
            data: {
              creditId: '019f7a01-0341-7c31-9b2d-000000000001',
              resolution: 'PAID',
              resolvedAt: '2026-09-21T02:00:00.000Z',
            },
          })
        )
      )
      const { spy, wrapper } = siapkan()
      const { result } = renderHook(() => useResolveHeldCredit(), { wrapper })

      result.current.mutate({
        id: '019f7a01-0341-7c31-9b2d-000000000001',
        input: {
          action: 'PAID',
          orderId: '019f7a01-0341-7c31-9b2d-000000000002',
          reason: 'Dicocokkan manual dengan rekening koran BNI pukul 09.15',
        },
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(menyentuhBadge(spy)).toBe(true)
    })

    test('memutuskan usulan orang kedua meng-invalidate hitungan badge', async () => {
      server.use(
        // Jalurnya `/approve` atau `/reject`, bukan `/decide`.
        http.post('*/api/v1/approvals/:id/approve', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { status: 'APPROVED', executedAt: null, executionError: null },
          })
        )
      )
      const { spy, wrapper } = siapkan()
      const { result } = renderHook(() => useDecideApproval(), { wrapper })

      result.current.mutate({
        id: '019f7a01-0341-7c31-9b2d-000000000003',
        decision: 'APPROVE',
        reason: 'Sudah dicek ke rekening koran, jumlah dan pengirim cocok',
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(menyentuhBadge(spy)).toBe(true)
    })
  })

  describe('negative', () => {
    test('mutasi yang GAGAL tidak meng-invalidate apa pun', async () => {
      // Invalidasi setelah kegagalan menarik ulang angka yang tidak berubah, dan
      // di layar ini tiap tarikan menyentuh endpoint uang.
      server.use(
        http.post('*/api/v1/held-credits/:id/resolve', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 }
          )
        )
      )
      const { spy, wrapper } = siapkan()
      const { result } = renderHook(() => useResolveHeldCredit(), { wrapper })

      result.current.mutate({
        id: '019f7a01-0341-7c31-9b2d-000000000001',
        input: {
          action: 'PAID',
          orderId: '019f7a01-0341-7c31-9b2d-000000000002',
          reason: 'Dicocokkan manual dengan rekening koran BNI pukul 09.15',
        },
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(menyentuhBadge(spy)).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('kunci yang dipakai PERSIS kunci yang dibaca `useQueueCounts`', () => {
      // Kunci yang salah ketik meng-invalidate cache yang tidak ada: mutasinya
      // sukses, tidak ada galat, dan badge-nya tetap membeku. Dipatok di sini
      // supaya perubahan nama kunci memerahkan berkas ini, bukan diam-diam.
      expect(QUEUE_COUNTS_KEY).toEqual(['queue-counts'])
    })
  })
})
