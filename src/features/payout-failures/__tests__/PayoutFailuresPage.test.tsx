import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import PayoutFailuresPage from '@/features/payout-failures/PayoutFailuresPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-662 — antrean Pencairan Bermasalah (sot/api/payout-failures.yaml).
// Handler MSW bawaan (5 order seed). Peran: stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/payout-failures', staffId = 'stf_2') {
  return renderWithProviders(<PayoutFailuresPage />, { initialEntries: [path], staffId })
}

function recordListQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/payout-failures') seen.push(url.search)
  })
  return seen
}

describe('PayoutFailuresPage @ USDX-662', () => {
  describe('positive', () => {
    test('should render the open queue oldest-first with the full account and exact amount', async () => {
      const { container } = setup()
      expect(await screen.findByText('RINA SUSANTI')).toBeInTheDocument()
      // Baris bisa diklik (role tombol), jadi dibaca dari tbody — seed tertua = RINA SUSANTI.
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      expect(rows).toHaveLength(5)
      expect(within(rows[0]!).getByText('8730012245')).toBeInTheDocument()
      expect(within(rows[0]!).getByText('Rp 4.012.350,00')).toBeInTheDocument()
      expect(within(rows[0]!).getByText('Payout gagal')).toBeInTheDocument()
      // Kode mesin diterjemahkan, tidak dirender mentah.
      expect(within(rows[0]!).getByText('Ditolak provider saat diserahkan')).toBeInTheDocument()
    })

    test('should send issueKind from the URL and show only that population', async () => {
      const seen = recordListQueries()
      setup('/payout-failures?issueKind=BURN_REJECTED')
      expect(await screen.findByText('DEWI KARTIKA')).toBeInTheDocument()
      expect(screen.queryByText('RINA SUSANTI')).not.toBeInTheDocument()
      expect(seen.some((q) => q.includes('issueKind=BURN_REJECTED'))).toBe(true)
    })

    test('should mark a partner order and show its partner label', async () => {
      setup()
      expect(await screen.findByText('Pintu Kripto / cust-88120')).toBeInTheDocument()
      expect(screen.getByText('Partner')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should tell STAFF the screen is read-only', async () => {
      setup('/payout-failures', 'stf_4')
      await screen.findByText('RINA SUSANTI')
      expect(screen.getByText('Hanya bisa melihat')).toBeInTheDocument()
    })

    test('should not show the read-only marker to a MANAGER', async () => {
      setup()
      await screen.findByText('RINA SUSANTI')
      expect(screen.queryByText('Hanya bisa melihat')).not.toBeInTheDocument()
    })

    test('should render an error state, not an empty queue, when the list fails', async () => {
      server.use(
        http.get('/api/v1/payout-failures', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'INTERNAL_SERVER_ERROR', message: 'x' } },
            { status: 500 },
          ),
        ),
      )
      setup()
      await waitFor(() => expect(screen.queryByText('Tidak ada pencairan bermasalah')).not.toBeInTheDocument())
      expect(await screen.findByRole('button', { name: /coba lagi/i })).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should not send an issueKind the contract does not know', async () => {
      const seen = recordListQueries()
      setup('/payout-failures?issueKind=NOPE')
      await screen.findByText('RINA SUSANTI')
      expect(seen.every((q) => !q.includes('issueKind'))).toBe(true)
    })

    test('should explain an empty queue', async () => {
      server.use(
        http.get('/api/v1/payout-failures', () =>
          HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 10, total: 0 }, data: [] }),
        ),
      )
      setup()
      expect(await screen.findByText('Tidak ada pencairan bermasalah')).toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// NOMINAL DAN NOMOR REKENING HARUS BISA DIBACA UTUH — PEMBLOKIR.
//
// Sel data di tabel dipaksa satu baris dan dipotong (`src/index.css`). Untuk sel
// yang isinya kotak BLOK — pola dua baris yang dipakai kolom Nominal dan
// Rekening tujuan — `text-overflow: ellipsis` TIDAK BERLAKU, jadi "Rp
// 4.012.350,00" terpotong jadi "Rp 4.012.350,0" TANPA satu pun tanda di layar,
// di layar tempat operator memutuskan mengirim ulang rupiah ke nasabah.
//
// Dua sisi perbaikannya diuji di dua tempat:
//   - LEBARNYA diukur di `e2e/usdx-lebar-sel.spec.ts` (jsdom tidak punya tata
//     letak, jadi lebar tidak bisa diuji di sini);
//   - NILAI UTUHNYA dikunci di sini. Selama `title` memuat nominal dan nomor
//     rekening yang lengkap, nilai yang terpotong tetap bisa dibaca —
//     dan kalau seseorang membuang `TableCellStack`, tes ini merah.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `title` terdekat ke atas dari sebuah simpul teks, sampai batas selnya.
 *
 * Judulnya tidak selalu di elemen yang memegang teks: baris "Bank Negara
 * Indonesia 009" adalah satu `title` di pembungkusnya dengan `<span>` kode bank
 * di dalamnya. Yang dijaga adalah pertanyaan operator — "nilai penuhnya masih
 * bisa saya baca?" — bukan di elemen mana atributnya kebetulan dipasang.
 */
function titleTerdekat(el: HTMLElement, batas: HTMLElement): string | null {
  let cur: HTMLElement | null = el
  while (cur && cur !== batas.parentElement) {
    const t = cur.getAttribute('title')
    if (t) return t
    cur = cur.parentElement
  }
  return null
}

describe('PayoutFailuresPage — nilai uang & rekening tidak pernah hilang', () => {
  describe('positive', () => {
    test('nominal rupiah membawa nilai UTUH di title', async () => {
      const { container } = setup()
      await screen.findByText('RINA SUSANTI')
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      const sel = rows[0]!.querySelector('[data-col="amount"]')!
      const nominal = within(sel as HTMLElement).getByText('Rp 4.012.350,00')
      expect(nominal).toHaveAttribute('title', 'Rp 4.012.350,00')
    })

    test('nomor rekening membawa nilai UTUH di title', async () => {
      const { container } = setup()
      await screen.findByText('RINA SUSANTI')
      const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      const sel = rows[0]!.querySelector('[data-col="destination"]')!
      const nomor = within(sel as HTMLElement).getByText('8730012245')
      expect(nomor).toHaveAttribute('title', '8730012245')
    })

    test('setiap sel Nominal dan Rekening tujuan punya title di SEMUA baris', async () => {
      // Bukan cuma baris pertama: cacatnya lahir dari satu kolom yang lupa
      // disebutkan, jadi pagarnya menyapu seluruh halaman.
      const { container } = setup()
      await screen.findByText('RINA SUSANTI')
      const tanpaTitle: string[] = []
      for (const row of container.querySelectorAll<HTMLElement>('tbody tr')) {
        for (const kolom of ['amount', 'destination']) {
          const sel = row.querySelector<HTMLElement>(`[data-col="${kolom}"]`)
          if (!sel) continue
          for (const span of sel.querySelectorAll<HTMLElement>('span')) {
            const teks = span.textContent?.trim() ?? ''
            // Hanya simpul daun yang benar-benar memegang teks.
            if (!teks || span.querySelector('span')) continue
            const title = titleTerdekat(span, sel)
            if (!title || !title.includes(teks)) {
              tanpaTitle.push(`${kolom}: "${teks}" (title=${title ?? 'tidak ada'})`)
            }
          }
        }
      }
      expect(tanpaTitle).toEqual([])
    })
  })
})
