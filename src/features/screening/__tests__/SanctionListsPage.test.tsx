import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import SanctionListsPage from '@/features/screening/SanctionListsPage'
import { renderWithProviders } from '@/test/test-utils'
import type { RescanSummary, SanctionListItem } from '@/lib/types'

// USDX-588 — versi daftar sanksi: impor tiga langkah, aktivasi, pemindaian ulang.
//
// Yang dijaga: (1) berkas dibaca dan dihitung SEBELUM versi DRAFT dibuat,
// (2) tiap potongan yang dikirim membawa baris header, (3) mengaktifkan versi
// selalu MENAWARKAN pemindaian ulang — celah antara "daftar baru aktif" dan
// "nasabah lama sudah diperiksa dengannya" adalah celah yang tidak boleh
// ditinggalkan diam-diam.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const listRow = (overrides: Partial<SanctionListItem> = {}): SanctionListItem => ({
  id: 'lst_1',
  listType: 'DTTOT',
  source: 'PPATK',
  publishedAt: '2026-07-01',
  status: 'ACTIVE',
  entryCount: 1200,
  sourceFileName: 'dttot-jul-2026.csv',
  notes: null,
  importedByName: 'Linda Chen',
  importedAt: '2026-07-02T02:00:00Z',
  activatedAt: '2026-07-02T02:05:00Z',
  supersededAt: null,
  ...overrides,
})

const summary = (overrides: Partial<RescanSummary> = {}): RescanSummary => ({
  lists: [{ id: 'lst_1', listType: 'DTTOT', publishedAt: '2026-07-01' }],
  scanned: 1500,
  matched: 3,
  noMatch: 1495,
  skipped: 2,
  truncated: false,
  ...overrides,
})

function ok(data: unknown) {
  return HttpResponse.json({ status: 'success', metadata: null, data })
}

function okList(rows: SanctionListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 10, total: rows.length },
    data: rows,
  })
}

function TestApp() {
  return (
    <Routes>
      <Route path="/screening/lists" element={<SanctionListsPage />} />
      <Route path="/screening" element={<div>Antrean temuan</div>} />
    </Routes>
  )
}

function setup() {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/screening/lists'],
    authenticated: true,
    staffId: 'stf_2', // Linda Chen, MANAGER
  })
}

/** Berkas CSV palsu — `File.text()` tersedia di jsdom lewat Blob. */
function csvFile(content: string, name = 'dttot.csv') {
  return new File([content], name, { type: 'text/csv' })
}

const CSV = ['full_name,entry_type', 'BUDI SANTOSO,INDIVIDUAL', 'YAYASAN AMAL,ENTITY'].join('\n')

describe('SanctionListsPage @ USDX-588', () => {
  describe('positive', () => {
    test('should render a list version with its published date and importer', async () => {
      server.use(http.get('/api/v1/screening/lists', () => okList([listRow()])))
      setup()

      expect(await screen.findByText('2026-07-01')).toBeInTheDocument()
      expect(screen.getByText('Linda Chen')).toBeInTheDocument()
      expect(screen.getByText('Aktif')).toBeInTheDocument()
      expect(screen.getByText('1.200')).toBeInTheDocument()
    })

    test('should preview the entry count BEFORE creating anything', async () => {
      // Impor tiga langkah dan tidak ada endpoint untuk menghapus versi DRAFT,
      // jadi angka entri hanya berguna kalau ia muncul saat masih bisa
      // membatalkan sesuatu.
      const user = userEvent.setup()
      let created = 0
      server.use(
        http.get('/api/v1/screening/lists', () => okList([])),
        http.post('/api/v1/screening/lists', () => {
          created++
          return ok(listRow({ status: 'DRAFT' }))
        }),
      )
      setup()
      await user.click(await screen.findByRole('button', { name: /impor daftar/i }))

      const dialog = await screen.findByRole('dialog')
      await user.upload(
        within(dialog).getByLabelText(/berkas csv/i),
        csvFile(CSV),
      )

      const preview = await within(dialog).findByTestId('sanction-csv-preview')
      expect(within(preview).getByText(/2 entri terbaca/)).toBeInTheDocument()
      expect(within(preview).getByText(/1 perorangan · 1 badan usaha/)).toBeInTheDocument()
      // Belum ada apa pun yang dibuat di server.
      expect(created).toBe(0)
    })

    test('should create the draft then upload the entries, header on every chunk', async () => {
      const user = userEvent.setup()
      const chunks: string[] = []
      let createBody: unknown = null
      server.use(
        http.get('/api/v1/screening/lists', () => okList([])),
        http.post('/api/v1/screening/lists', async ({ request }) => {
          createBody = await request.json()
          return ok(listRow({ status: 'DRAFT', entryCount: 0 }))
        }),
        http.post('/api/v1/screening/lists/lst_1/entries', async ({ request }) => {
          const body = (await request.json()) as { csv: string }
          chunks.push(body.csv)
          return ok({ listId: 'lst_1', inserted: 2, totalEntries: 2 })
        }),
      )
      setup()
      await user.click(await screen.findByRole('button', { name: /impor daftar/i }))

      const dialog = await screen.findByRole('dialog')
      await user.upload(within(dialog).getByLabelText(/berkas csv/i), csvFile(CSV))
      await within(dialog).findByTestId('sanction-csv-preview')
      await user.type(within(dialog).getByLabelText(/tanggal terbit/i), '2026-07-01')
      await user.click(within(dialog).getByRole('button', { name: /impor entri/i }))

      await waitFor(() => expect(chunks.length).toBeGreaterThan(0))
      expect(createBody).toMatchObject({
        listType: 'DTTOT',
        source: 'PPATK',
        publishedAt: '2026-07-01',
        sourceFileName: 'dttot.csv',
      })
      chunks.forEach((chunk) => expect(chunk.startsWith('full_name,entry_type')).toBe(true))
      expect(await within(dialog).findByText(/2 entri/)).toBeInTheDocument()
    })

    test('should offer a rescan after a version is activated', async () => {
      // Mengaktifkan daftar TIDAK memeriksa ulang nasabah lama — server
      // memisahkan keduanya. Tanpa tawaran ini, celahnya tidak pernah ditutup.
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/screening/lists', () => okList([listRow({ status: 'DRAFT' })])),
        http.post('/api/v1/screening/lists/lst_1/activate', () => ok(listRow())),
      )
      setup()

      await user.click(await screen.findByRole('button', { name: /aktifkan/i }))
      expect(
        await screen.findByText(/periksa ulang nasabah dengan daftar ini/i),
      ).toBeInTheDocument()
    })

    test('should report the rescan summary', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/screening/lists', () => okList([listRow()])),
        http.post('/api/v1/screening/rescan', () => ok(summary())),
      )
      setup()

      await user.click(await screen.findByRole('button', { name: /pindai ulang/i }))
      const panel = await screen.findByTestId('rescan-summary')
      expect(within(panel).getByText(/1.500 subjek diperiksa/)).toBeInTheDocument()
      expect(within(panel).getByText(/3 temuan/)).toBeInTheDocument()
      // Yang dilewati bukan kegagalan — namanya sudah dikosongkan sweeper retensi.
      expect(within(panel).getByText(/sweeper\s+retensi/i)).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should refuse a CSV with no full_name column, without creating a draft', async () => {
      const user = userEvent.setup()
      let created = 0
      server.use(
        http.get('/api/v1/screening/lists', () => okList([])),
        http.post('/api/v1/screening/lists', () => {
          created++
          return ok(listRow({ status: 'DRAFT' }))
        }),
      )
      setup()
      await user.click(await screen.findByRole('button', { name: /impor daftar/i }))

      const dialog = await screen.findByRole('dialog')
      await user.upload(
        within(dialog).getByLabelText(/berkas csv/i),
        csvFile('nama,umur\nBudi,30'),
      )

      expect(
        await within(dialog).findByText(
          /Kolom "full_name" tidak ditemukan di baris header/i,
        ),
      ).toBeInTheDocument()
      expect(created).toBe(0)
      // Tanpa berkas yang sah, tombol impor tetap tertutup.
      expect(within(dialog).getByRole('button', { name: /impor entri/i })).toBeDisabled()
    })

    test('should require a published date — it is not the import date', async () => {
      const user = userEvent.setup()
      let created = 0
      server.use(
        http.get('/api/v1/screening/lists', () => okList([])),
        http.post('/api/v1/screening/lists', () => {
          created++
          return ok(listRow({ status: 'DRAFT' }))
        }),
      )
      setup()
      await user.click(await screen.findByRole('button', { name: /impor daftar/i }))

      const dialog = await screen.findByRole('dialog')
      await user.upload(within(dialog).getByLabelText(/berkas csv/i), csvFile(CSV))
      await within(dialog).findByTestId('sanction-csv-preview')
      await user.click(within(dialog).getByRole('button', { name: /impor entri/i }))

      expect(await within(dialog).findByText(/tanggal terbit wajib diisi/i)).toBeInTheDocument()
      expect(created).toBe(0)
    })

    test('should explain SANCTION_LIST_EMPTY instead of showing a bare 400', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      server.use(
        http.get('/api/v1/screening/lists', () => okList([listRow({ status: 'DRAFT' })])),
        http.post('/api/v1/screening/lists/lst_1/activate', () =>
          HttpResponse.json(
            {
              status: 'error',
              error: { code: 'SANCTION_LIST_EMPTY', message: 'empty' },
            },
            { status: 400 },
          ),
        ),
      )
      setup()
      await user.click(await screen.findByRole('button', { name: /aktifkan/i }))

      // Aktivasi daftar kosong akan mencatat setiap nasabah sebagai "lolos".
      await waitFor(() =>
        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining('belum berisi satu entri pun'),
        ),
      )
      errSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    test('should offer to continue a truncated rescan', async () => {
      const user = userEvent.setup()
      let calls = 0
      server.use(
        http.get('/api/v1/screening/lists', () => okList([listRow()])),
        http.post('/api/v1/screening/rescan', () => {
          calls++
          return ok(summary({ truncated: calls === 1 }))
        }),
      )
      setup()

      await user.click(await screen.findByRole('button', { name: /pindai ulang/i }))
      const panel = await screen.findByTestId('rescan-summary')
      await user.click(within(panel).getByRole('button', { name: /lanjutkan pemindaian/i }))

      await waitFor(() => expect(calls).toBe(2))
    })

    test('should not offer Activate on a version that is already active', async () => {
      server.use(http.get('/api/v1/screening/lists', () => okList([listRow()])))
      setup()
      await screen.findByText('2026-07-01')
      expect(screen.queryByRole('button', { name: /^aktifkan$/i })).not.toBeInTheDocument()
    })
  })
})
