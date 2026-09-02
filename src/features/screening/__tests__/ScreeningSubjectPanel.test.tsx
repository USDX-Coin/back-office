import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import ScreeningSubjectPanel from '@/features/screening/ScreeningSubjectPanel'
import { renderWithProviders } from '@/test/test-utils'
import type { ScreeningResultItem } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-610 — status screening di halaman review KYC & KYB.
//
// Temuan yang melahirkan panel ini: berkas KYB `01a06155-f4a0…` memegang
// `LIST_UNAVAILABLE` untuk DPPSPM pada 08:56:58 lalu disetujui VERIFIED pada
// 08:58:07 — 69 detik kemudian, tanpa petugas pernah tahu. Keputusannya: JANGAN
// ubah gerbangnya (fail-open tetap benar), perbaiki lolosnya yang diam-diam.
//
// `/api/v1/screening/*` dilayani backend sungguhan dan tidak punya handler MSW,
// jadi tiap tes menyetel endpointnya sendiri.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const SUBJECT_ID = '01a06155-f4a0-7000-8000-000000000001'

const row = (overrides: Partial<ScreeningResultItem> = {}): ScreeningResultItem => ({
  id: 'scr_1',
  subjectType: 'KYC',
  subjectId: SUBJECT_ID,
  outcome: 'NO_MATCH',
  score: 0.1,
  matchedName: null,
  matchCount: 0,
  trigger: 'KYC_SUBMIT',
  listId: 'lst_dttot',
  listType: 'DTTOT',
  listPublishedAt: '2026-08-16',
  decision: null,
  createdAt: '2026-09-02T08:56:58Z',
  ...overrides,
})

/** Baris `LIST_UNAVAILABLE` sebagaimana kontraknya: TANPA jenis daftar. */
const unavailable = (overrides: Partial<ScreeningResultItem> = {}): ScreeningResultItem =>
  row({
    id: 'scr_unavailable',
    outcome: 'LIST_UNAVAILABLE',
    score: null,
    listId: null,
    listType: null,
    listPublishedAt: null,
    ...overrides,
  })

function stub(rows: ScreeningResultItem[], total = rows.length) {
  server.use(
    http.get('/api/v1/screening/results', () =>
      HttpResponse.json({
        status: 'success',
        metadata: { page: 1, limit: 100, total },
        data: rows,
      }),
    ),
  )
}

function setup(subjectId: string | null = SUBJECT_ID) {
  return renderWithProviders(
    <ScreeningSubjectPanel subjectType="KYC" subjectId={subjectId} />,
    { initialEntries: ['/kyc'], authenticated: true },
  )
}

describe('ScreeningSubjectPanel @ USDX-610', () => {
  describe('positive', () => {
    test('should show both required lists with the version they were checked against', async () => {
      // "Lolos pakai daftar terbitan tanggal berapa" adalah pertanyaan pemeriksa,
      // dan jawabannya harus ada di layar yang sama dengan tombol Approve.
      stub([
        row({ id: 'a', listType: 'DTTOT', listPublishedAt: '2026-08-16' }),
        row({ id: 'b', listType: 'DPPSPM', listId: 'lst_dppspm', listPublishedAt: '2026-08-03' }),
      ])
      setup()

      const dttot = await screen.findByTestId('screening-list-DTTOT')
      expect(within(dttot).getByText('Tidak cocok')).toBeInTheDocument()
      expect(within(dttot).getByText(/2026-08-16/)).toBeInTheDocument()

      const dppspm = screen.getByTestId('screening-list-DPPSPM')
      expect(within(dppspm).getByText('Tidak cocok')).toBeInTheDocument()
      expect(within(dppspm).getByText(/2026-08-03/)).toBeInTheDocument()

      expect(screen.queryByTestId('screening-unchecked')).not.toBeInTheDocument()
    })

    test('should NAME the list that could not be checked, not just say "unavailable"', async () => {
      // Persis keadaan 2 Sep: DTTOT terbaca, DPPSPM tidak.
      stub([row({ id: 'a', listType: 'DTTOT' }), unavailable()])
      setup()

      const banner = await screen.findByTestId('screening-unchecked')
      expect(banner).toHaveTextContent(/DPPSPM/)
      expect(banner).toHaveTextContent(/belum pernah berhasil dicek/i)
      expect(banner).toHaveTextContent(/LIST_UNAVAILABLE/)
      // Daftar yang MEMANG tercek tidak boleh ikut disebut — banner yang menuduh
      // semuanya akan dibaca sebagai kebisingan lalu dilewati.
      expect(banner).not.toHaveTextContent(/DTTOT/)
    })

    test('should say the file was never screened at all, which is not the same thing', async () => {
      stub([])
      setup()

      const note = await screen.findByTestId('screening-never')
      expect(note).toHaveTextContent(/belum ada satu pun jejak/i)
      expect(note).toHaveTextContent(/Pasal 53/)
    })
  })

  describe('negative', () => {
    test('should NEVER render a control that could block approve', async () => {
      // Fail-open adalah keputusan yang masih berlaku. Panel ini menyatakan
      // keadaan; ia tidak boleh punya tombol yang bisa menahan berkas.
      stub([unavailable()])
      setup()

      await screen.findByTestId('screening-unchecked')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.getByTestId('screening-unchecked')).toHaveTextContent(
        /Approve TIDAK diblokir/i,
      )
    })

    test('should say the status is unknown when the request fails, not render an empty panel', async () => {
      // Panel kosong terbaca sebagai "bersih" — kebalikan dari yang diketahui.
      server.use(
        http.get('/api/v1/screening/results', () =>
          HttpResponse.json({ status: 'error' }, { status: 500 }),
        ),
      )
      setup()

      const err = await screen.findByTestId('screening-panel-error')
      expect(err).toHaveTextContent(/tidak bisa dibaca/i)
      expect(err).toHaveTextContent(/jangan simpulkan berkas ini bersih/i)
    })

    test('should announce a finding that still holds the subject', async () => {
      stub([
        row({
          id: 'a',
          outcome: 'POTENTIAL_MATCH',
          score: 0.92,
          matchedName: 'BUDI SANTOSO',
          matchCount: 1,
        }),
        row({ id: 'b', listType: 'DPPSPM', listId: 'lst_dppspm' }),
      ])
      setup()

      const holding = await screen.findByTestId('screening-holding')
      expect(holding).toHaveTextContent(/masih menahan/i)
      expect(holding).toHaveTextContent(/409/)
    })
  })

  describe('edge cases', () => {
    test('should not fetch at all without a subject id', async () => {
      let calls = 0
      server.use(
        http.get('/api/v1/screening/results', () => {
          calls++
          return HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 100, total: 0 },
            data: [],
          })
        }),
      )
      setup(null)

      await waitFor(() => expect(screen.getByTestId('screening-panel')).toBeInTheDocument())
      expect(calls).toBe(0)
    })

    test('should still report a past read failure once both lists have been checked', async () => {
      // Kedua daftar akhirnya tercek, tapi kegagalan yang tercatat tetap bagian
      // dari jejaknya — menghapusnya dari layar berarti mengarang riwayat.
      stub([
        row({ id: 'a', listType: 'DTTOT', createdAt: '2026-08-16T00:00:00Z' }),
        row({ id: 'b', listType: 'DPPSPM', listId: 'lst_dppspm', createdAt: '2026-08-16T00:00:00Z' }),
        unavailable({ createdAt: '2026-08-01T00:00:00Z' }),
      ])
      setup()

      const note = await screen.findByTestId('screening-unavailable-history')
      expect(note).toHaveTextContent(/1 pemeriksaan tercatat/i)
      expect(screen.queryByTestId('screening-unchecked')).not.toBeInTheDocument()
    })

    test('should say so when the trail is longer than one page instead of silently trimming', async () => {
      stub([row({ id: 'a', listType: 'DTTOT' }), row({ id: 'b', listType: 'DPPSPM' })], 240)
      setup()

      expect(await screen.findByText(/Menampilkan 2 jejak terbaru dari 240/)).toBeInTheDocument()
    })
  })
})
