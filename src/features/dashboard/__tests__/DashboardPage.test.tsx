import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { RouteObject } from 'react-router'
import { appRoutes } from '@/App'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import DashboardPage from '@/features/dashboard/DashboardPage'
import { DASHBOARD_STATS_POLL_MS } from '@/features/dashboard/hooks'
import type { DashboardStats } from '@/lib/types'
import { renderWithProviders } from '@/test/test-utils'

// Strip non-digits from both sides and assert digit subsequence — verifies the
// API value reached the user without coupling the test to display formatting
// (which is an AI-assumption, not a SoT requirement).
function expectDigitsRendered(container: HTMLElement, decimalString: string) {
  const expected = decimalString.replace(/\D/g, '')
  const actual = (container.textContent ?? '').replace(/\D/g, '')
  expect(actual).toContain(expected)
}

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// USDX-37: legacy mock-domain DashboardPage tests removed (KPI cards, Volume
// Trend, Network split, Recent Activity). Those components are gone — see
// USDX-37 PR description § Out of SoT for the rationale. SoT-aligned coverage
// continues in `USDX-16 acceptance criteria` below.

describe('DashboardPage', () => {
  test('renders header + Phase1Stats panel', async () => {
    renderWithProviders(<DashboardPage />, { authenticated: true })
    // § 4 P1-3 — "Dashboard / overview" jadi "Beranda / ringkasan".
    expect(
      screen.getByRole('heading', { name: /beranda.*ringkasan/i })
    ).toBeInTheDocument()
    await waitFor(
      () => expect(screen.getByTestId('dashboard-phase1-stats')).toBeInTheDocument(),
      { timeout: 3000 }
    )
  })
})

// USDX-16 acceptance criteria — Linear ticket:
//   1. Open /dashboard → all stats displayed
//   2. Numbers match API response
//   3. Click "pending requests" → navigate to filtered request list
//   4. Data refreshes without manual reload
//
// Stats schema reference: sot/openapi.yaml § DashboardStats (7 fields).
describe('USDX-16 acceptance criteria', () => {
  test('AC1: opens /dashboard and displays every SoT DashboardStats field', async () => {
    renderWithProviders(<DashboardPage />, { authenticated: true })

    // safe-balance-staff renders only after useDashboardStats resolves —
    // doubles as the data-loaded gate.
    await waitFor(
      () => expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument(),
      { timeout: 3000 }
    )

    // 6 panel statistik on-chain. `pendingRequests` tidak lagi punya kartunya
    // sendiri di sini — lihat catatan P0-5 di bawah; angkanya pindah ke papan
    // antrean (dua kartu: Mint OTC + Burn OTC) dan tetap disebut di subtitle.
    expect(screen.getByTestId('stat-total-supply')).toBeInTheDocument()
    expect(screen.getByTestId('stat-total-minted')).toBeInTheDocument()
    expect(screen.getByTestId('stat-total-burned')).toBeInTheDocument()
    expect(screen.getByTestId('stat-requests-by-status')).toBeInTheDocument()
    expect(screen.getByTestId('stat-safe-balances')).toBeInTheDocument()
    expect(screen.getByTestId('stat-current-rate')).toBeInTheDocument()

    // safeBalances → both Staff + Manager rows
    expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument()
    expect(screen.getByTestId('safe-balance-manager')).toBeInTheDocument()

    // requestsByStatus → all 4 keys per openapi.yaml schema
    expect(screen.getByTestId('requests-status-PENDING_APPROVAL')).toBeInTheDocument()
    expect(screen.getByTestId('requests-status-APPROVED')).toBeInTheDocument()
    expect(screen.getByTestId('requests-status-EXECUTED')).toBeInTheDocument()
    expect(screen.getByTestId('requests-status-REJECTED')).toBeInTheDocument()
  })

  test('AC2: every rendered value matches /api/v1/dashboard/stats payload', async () => {
    const stats = (await (await fetch('/api/v1/dashboard/stats')).json()).data as DashboardStats

    renderWithProviders(<DashboardPage />, { authenticated: true })
    await waitFor(
      () => expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument(),
      { timeout: 3000 }
    )

    const statusCard = screen.getByTestId('stat-requests-by-status')
    for (const [status, count] of Object.entries(stats.requestsByStatus)) {
      const row = within(statusCard).getByTestId(`requests-status-${status}`)
      expect(within(row).getByText(count.toLocaleString())).toBeInTheDocument()
    }

    // Decimal-string fields — assert digit subsequence reaches the user
    expectDigitsRendered(screen.getByTestId('stat-total-supply'), stats.totalSupply)
    expectDigitsRendered(screen.getByTestId('stat-total-minted'), stats.totalMinted)
    expectDigitsRendered(screen.getByTestId('stat-total-burned'), stats.totalBurned)
    expectDigitsRendered(screen.getByTestId('safe-balance-staff'), stats.safeBalances.staff)
    expectDigitsRendered(screen.getByTestId('safe-balance-manager'), stats.safeBalances.manager)
    expectDigitsRendered(screen.getByTestId('stat-current-rate'), stats.currentRate)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // AC3 — § 4 P0-5. Tes ini DULU berbunyi: 'clicking "pending requests" routes
  // to /requests?status=PENDING_APPROVAL', dan ia HIJAU selama berbulan-bulan
  // sambil mengunci tautan yang rusak: rute `/requests` tidak pernah
  // didaftarkan di `App.tsx`, jadi ia kena `{ path: '*' }` → `Navigate
  // to="/login"` → `PublicRoute` melihat sesi masih hidup → dilempar balik ke
  // `/dashboard`. Kartu itu memantul diam-diam ke halaman yang sama.
  //
  // Tesnya hijau karena ia hanya memeriksa atribut `href`, bukan ke mana
  // tautannya MENDARAT. Itu sebabnya versi barunya memeriksa rutenya benar-benar
  // terdaftar di `appRoutes`, bukan sekadar mencocokkan string.
  // ─────────────────────────────────────────────────────────────────────────
  test('AC3: kartu antrean OTC menaut ke rute yang BENAR-BENAR terdaftar', async () => {
    renderWithProviders(<DashboardPage />, { authenticated: true })

    const mintCard = await screen.findByTestId('queue-card-mint')
    const burnCard = screen.getByTestId('queue-card-burn')
    expect(mintCard).toHaveAttribute('href', '/mint?status=PENDING_APPROVAL')
    expect(burnCard).toHaveAttribute('href', '/burn?status=PENDING_APPROVAL')

    // Rute yang lama sudah tidak dirender di mana pun.
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.startsWith('/requests'))).toBe(false)

    // Dan ini bagian yang dulu tidak pernah diperiksa: tiap tujuan kartu harus
    // punya rute terdaftar, sehingga tidak ada lagi yang bisa memantul ke /login.
    const registered = new Set(
      appRoutes
        .flatMap(function paths(r: RouteObject): string[] {
          return [r.path ?? '', ...(r.children ?? []).flatMap(paths)]
        })
        .filter(Boolean),
    )
    for (const href of hrefs) {
      expect(registered.has(href.split('?')[0]!)).toBe(true)
    }
  })

  test('AC4: data refreshes without manual reload (polling interval is configurable)', () => {
    // Contract assertion: configurable constant matches Linear ticket scope
    // ("polling every 30 seconds or configurable"). Behavioral assertion lives
    // in the next test.
    expect(DASHBOARD_STATS_POLL_MS).toBe(30_000)
  })

  test('AC4: useDashboardStats refetches /api/v1/dashboard/stats after the configured interval elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    try {
      renderWithProviders(<DashboardPage />, { authenticated: true })

      // Wait for the first fetch of /api/v1/dashboard/stats to land.
      await waitFor(() => {
        const calls = fetchSpy.mock.calls.filter(([url]) =>
          String(url).includes('/api/v1/dashboard/stats')
        )
        expect(calls.length).toBeGreaterThanOrEqual(1)
      })

      const before = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes('/api/v1/dashboard/stats')
      ).length

      // Advance just past the configured polling interval.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DASHBOARD_STATS_POLL_MS + 500)
      })

      await waitFor(() => {
        const after = fetchSpy.mock.calls.filter(([url]) =>
          String(url).includes('/api/v1/dashboard/stats')
        ).length
        expect(after).toBeGreaterThan(before)
      })
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})

// USDX-78 — STAFF tidak boleh menyentuh `/api/v1/requests*`, jadi kartu antrean
// OTC tidak dirender untuknya (tautannya hanya akan memantul ke /mint/new).
// Gerbangnya tidak berubah oleh P1-3; yang berubah kartunya.
describe('USDX-78 — visibilitas kartu antrean OTC', () => {
  test('hidden for STAFF role', async () => {
    renderWithProviders(<DashboardPage />, { staffId: 'stf_4' /* Sarah King (STAFF) */ })
    await waitFor(
      () => expect(screen.getByTestId('safe-balance-staff')).toBeInTheDocument(),
      { timeout: 3000 }
    )
    expect(screen.queryByTestId('queue-card-mint')).not.toBeInTheDocument()
    expect(screen.queryByTestId('queue-card-burn')).not.toBeInTheDocument()
    // Antrean yang memang terbuka untuk STAFF tetap tampil.
    expect(screen.getByTestId('queue-card-redeem-approvals')).toBeInTheDocument()
    expect(screen.getByTestId('queue-card-payout-failures')).toBeInTheDocument()
    expect(screen.getByTestId('stat-total-supply')).toBeInTheDocument()
  })

  test('visible for ADMIN role', async () => {
    renderWithProviders(<DashboardPage />, { staffId: 'stf_1' /* Marcus Thorne (ADMIN) */ })
    await waitFor(
      () => expect(screen.getByTestId('queue-card-mint')).toBeInTheDocument(),
      { timeout: 3000 }
    )
  })
})

// ───────────────────────────────────────────────────────────────────────────
// § 4 P1-3 — Beranda sebagai papan kerja.
//
// Sebelumnya halaman ini tidak menyebut SATU PUN antrean kerja: isinya pasokan
// token, volume seumur hidup, saldo Safe, dan kurs. Kelima angka antreannya
// sudah ditarik untuk badge sidebar; yang tidak pernah ada adalah tempat
// membacanya sebagai pekerjaan.
// ───────────────────────────────────────────────────────────────────────────
describe('P1-3 — papan antrean di Beranda', () => {
  describe('positive', () => {
    test('menampilkan kelima antrean kerja, masing-masing menaut ke antreannya', async () => {
      renderWithProviders(<DashboardPage />, { authenticated: true })
      const expected: Array<[string, string]> = [
        ['queue-card-redeem-approvals', '/redeem-approvals'],
        ['queue-card-payout-failures', '/payout-failures'],
        ['queue-card-kyc', '/kyc'],
        ['queue-card-kyb', '/kyb'],
        ['queue-card-screening', '/screening'],
      ]
      for (const [testId, href] of expected) {
        expect(await screen.findByTestId(testId)).toHaveAttribute('href', href)
      }
    })

    test('angka antrean dibaca dari queue-counts, bukan dari list yang mendekripsi PII', async () => {
      server.use(
        http.get('/api/v1/queue-counts', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { payoutFailuresOpen: 9, redeemApprovalsOpen: 4 },
          })
        )
      )
      renderWithProviders(<DashboardPage />, { authenticated: true })
      await waitFor(() =>
        expect(screen.getByTestId('queue-card-payout-failures')).toHaveTextContent('9')
      )
      expect(screen.getByTestId('queue-card-redeem-approvals')).toHaveTextContent('4')
    })
  })

  describe('negative', () => {
    // Risiko yang disebut eksplisit di dokumen audit: kartu yang menunjukkan 0
    // karena query-nya GAGAL akan menyatakan pekerjaan sudah selesai padahal
    // ada nasabah yang menunggu.
    test('hitungan yang GAGAL dibaca tidak pernah dirender sebagai 0', async () => {
      server.use(
        http.get('/api/v1/queue-counts', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL_ERROR', message: 'boom' },
            },
            { status: 500 }
          )
        )
      )
      renderWithProviders(<DashboardPage />, { authenticated: true })
      await waitFor(() =>
        expect(screen.getByTestId('queue-card-payout-failures')).toHaveTextContent(
          /belum terbaca/i
        )
      )
      expect(screen.getByTestId('queue-card-payout-failures')).not.toHaveTextContent(/^0$/)
    })
  })

  describe('edge cases', () => {
    test('papan antrean tetap tampil walau statistik on-chain gagal dimuat', async () => {
      // Daftar pekerjaan tidak boleh ikut hilang gara-gara
      // `/api/v1/dashboard/stats` yang mati.
      server.use(
        http.get('/api/v1/dashboard/stats', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL_ERROR', message: 'boom' },
            },
            { status: 500 }
          )
        )
      )
      renderWithProviders(<DashboardPage />, { authenticated: true })
      expect(await screen.findByTestId('queue-card-kyc')).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.queryByTestId('dashboard-phase1-stats')).not.toBeInTheDocument()
      )
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SATU KONVENSI ANGKA DI BERANDA.
//
// Layar ini dulu mencetak `12,450,000.00 USDX` (ribuan koma, desimal titik)
// tepat di sebelah `Rp16.250` (ribuan titik). Untuk pembaca Indonesia
// `12,450,000.00` bisa terbaca "dua belas koma empat" — enam kali lipat salah,
// di layar pertama yang dibuka operator tiap pagi.
//
// Pagar ini membaca SELURUH teks panel statistik dan menolak satu pun angka
// bergaya Inggris. Sengaja atas teks yang dirender, bukan atas fungsi format:
// cacatnya lahir dari dua helper yang masing-masing benar sendiri-sendiri dan
// salah ketika bersebelahan.
// ─────────────────────────────────────────────────────────────────────────────
describe('Beranda — ejaan angka Indonesia', () => {
  describe('positive', () => {
    test('nilai USDX dan kurs sama-sama memakai titik untuk ribuan', async () => {
      server.use(
        http.get('/api/v1/dashboard/stats', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              totalSupply: '12450000.00',
              totalMinted: '30000000.00',
              totalBurned: '17550000.00',
              safeBalances: { staff: '1250000.00', manager: '2500000.00' },
              currentRate: '16250.00',
              pendingRequests: 3,
              requestsByStatus: {
                PENDING_APPROVAL: 3,
                APPROVED: 1,
                EXECUTED: 2,
                REJECTED: 0,
              },
            } satisfies DashboardStats,
          }),
        ),
      )
      renderWithProviders(<DashboardPage />, { authenticated: true })

      const panel = await screen.findByTestId('dashboard-phase1-stats', undefined, {
        timeout: 3000,
      })
      await waitFor(() =>
        expect(within(panel).getByTestId('stat-total-supply').textContent).toContain(
          '12.450.000,00',
        ),
      )
      expect(within(panel).getByTestId('stat-current-rate').textContent).toContain(
        'Rp 16.250',
      )
      expect(within(panel).getByTestId('safe-balance-staff').textContent).toContain(
        '1.250.000,00',
      )
    })
  })

  describe('negative', () => {
    test('tidak ada satu pun angka bergaya Inggris di panel statistik', async () => {
      server.use(
        http.get('/api/v1/dashboard/stats', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              totalSupply: '12450000.00',
              totalMinted: '30000000.00',
              totalBurned: '17550000.00',
              safeBalances: { staff: '1250000.00', manager: '2500000.00' },
              currentRate: '16250.00',
              pendingRequests: 3,
              requestsByStatus: {
                PENDING_APPROVAL: 3,
                APPROVED: 1,
                EXECUTED: 2,
                REJECTED: 0,
              },
            } satisfies DashboardStats,
          }),
        ),
      )
      renderWithProviders(<DashboardPage />, { authenticated: true })
      const panel = await screen.findByTestId('dashboard-phase1-stats', undefined, {
        timeout: 3000,
      })
      await waitFor(() =>
        expect(within(panel).getByTestId('stat-total-supply').textContent).toContain(
          '12.450.000,00',
        ),
      )
      // `1,234` (koma sebagai pemisah ribuan) dan `.00` sebagai desimal.
      expect(panel.textContent ?? '').not.toMatch(/\d,\d{3}/)
      expect(panel.textContent ?? '').not.toMatch(/\d\.\d{2}(\D|$)/)
    })
  })
})
