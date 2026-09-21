import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// USDX-50 dulu: 3 section (WORKSPACE / OTC / SETTINGS), lalu tumbuh jadi 8.
//
// PEROMBAKAN ALUR (§ 4 P2-1): 5 section berbahasa Indonesia, dikelompokkan
// menurut pekerjaan operator. Tes ini DIUBAH mengikuti struktur baru — bentuk
// menunya dikunci per-peran di `navItems.test.ts`; yang dikunci DI SINI adalah
// apa yang benar-benar dirender Sidebar beserta badge-nya.

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Sidebar @ USDX-50', () => {
  describe('layout (admin)', () => {
    test('renders 5 section headers berbahasa Indonesia', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.getByText(/^pekerjaan hari ini$/i)).toBeInTheDocument()
      expect(screen.getByText(/^meja otc$/i)).toBeInTheDocument()
      expect(screen.getByText(/^keuangan$/i)).toBeInTheDocument()
      // "Nasabah" dan "Pengaturan" masing-masing dipakai sebagai judul section
      // SEKALIGUS sebagai nama satu entri di dalamnya — jadi TEPAT DUA.
      //
      // `toBeGreaterThanOrEqual(2)` yang dulu di sini juga hijau untuk 10: menu
      // yang dirender dua kali (pola `Navbar.test.tsx`) lolos tanpa suara.
      expect(screen.getAllByText(/^nasabah$/i)).toHaveLength(2)
      expect(screen.getAllByText(/^pengaturan$/i)).toHaveLength(2)
      // "Troubleshooting" sengaja hilang: memperbaiki request yang nyangkut
      // adalah pekerjaan, bukan kategori teknis tersendiri.
      expect(screen.queryByText(/troubleshooting/i)).not.toBeInTheDocument()
    })

    test('renders all admin nav links', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      // PEKERJAAN HARI INI
      expect(screen.getByRole('link', { name: /^beranda$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^transaksi nasabah$/i })).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: /^perbaiki status nyangkut$/i })
      ).toBeInTheDocument()
      // NASABAH
      expect(screen.getByRole('link', { name: /^nasabah$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^verifikasi perorangan$/i })).toBeInTheDocument()
      // MEJA OTC
      expect(screen.getByRole('link', { name: /^mint otc$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^burn otc$/i })).toBeInTheDocument()
      // KEUANGAN — empat entri Reporting sekarang satu entri "Laporan" yang
      // menunjuk laporan pertama; tiga sisanya dicapai lewat tab di halaman.
      expect(screen.getByRole('link', { name: /^laporan$/i })).toHaveAttribute(
        'href',
        '/reports/mint/daily'
      )
      expect(screen.getByRole('link', { name: /^antrean tanda tangan$/i })).toBeInTheDocument()
      // PENGATURAN — empat entri Settings sekarang satu entri "Pengaturan".
      expect(screen.getByRole('link', { name: /^pengaturan$/i })).toHaveAttribute(
        'href',
        '/settings/rate'
      )
      expect(screen.getByRole('link', { name: /^mode mint$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^pengguna internal$/i })).toBeInTheDocument()
    })
  })

  describe('regression guards (Linear AC: removed entries)', () => {
    test('does not render Profile (navbar dropdown only)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.queryByRole('link', { name: /profile/i })).not.toBeInTheDocument()
    })

    test('does not render removed entries (Redeem, Mint request, Requests, Notifications, Report)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.queryByRole('link', { name: /^redeem$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /mint request/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^requests$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^notifications$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^report$/i })).not.toBeInTheDocument()
    })

    test('tidak ada satu pun tautan sidebar yang menuju rute tak terdaftar', () => {
      // P0-5 lahir dari kartu Dashboard yang menaut ke `/requests`, rute yang
      // tidak pernah ada di `App.tsx` dan diam-diam memantul balik.
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
      expect(hrefs).not.toContain('/requests')
      expect(hrefs.every((h) => typeof h === 'string' && h.startsWith('/'))).toBe(true)
    })
  })

  describe('role gating', () => {
    test('Pengguna Internal hidden for non-admin (Flag-A: hidden per Linear)', () => {
      // stf_4 = Sarah King (STAFF role) per data.ts seed factory.
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4',
      })
      expect(
        screen.queryByRole('link', { name: /^pengguna internal$/i })
      ).not.toBeInTheDocument()
    })

    test('entri Pengaturan hidden for STAFF role (Flag-B) — Mode Mint tetap tampil', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // STAFF role
      })
      expect(screen.queryByRole('link', { name: /^pengaturan$/i })).not.toBeInTheDocument()
      // USDX-639 — rem darurat: STAFF harus tetap bisa mematikan mode uji.
      expect(screen.getByRole('link', { name: /^mode mint$/i })).toBeInTheDocument()
    })

    // USDX-485 (audit P1-18): On-Call di-gate di level ITEM, lebih ketat dari
    // section-nya. Daftar itu memuat nomor telepon (PII → ADMIN saja per
    // conventions.md § Audit Akses PII) dan menentukan siapa yang boleh menarik
    // rem darurat payout — DEVELOPER melihat Rate/Fee/Threshold, tapi tidak ini.
    // USDX-485 — gerbang On-Call (ADMIN saja, termasuk membaca) sekarang hidup
    // sebagai TAB di dalam halaman Pengaturan, bukan sebagai entri sidebar. Yang
    // menegakkannya tetap `RoleGuard` di `App.tsx`; daftar tabnya diuji di
    // `settingsTabDefs.test.ts`. Di sidebar yang tersisa untuk diuji adalah
    // entri "Pengaturan"-nya sendiri.
    test('entri Pengaturan visible for DEVELOPER (Flag-B: SoT § Backoffice Role System grants System Config)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_3', // Marcus Aurelius DEVELOPER
      })
      expect(screen.getByRole('link', { name: /^pengaturan$/i })).toBeInTheDocument()
      // Pengguna Internal tetap tersembunyi (ADMIN saja) walau untuk DEVELOPER.
      expect(
        screen.queryByRole('link', { name: /^pengguna internal$/i })
      ).not.toBeInTheDocument()
    })

    test('entri Pengaturan hidden for MANAGER', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_2', // Linda Chen, MANAGER
      })
      expect(screen.queryByRole('link', { name: /^pengaturan$/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^mode mint$/i })).toBeInTheDocument()
    })

    // Transparency lives under COMPLIANCE but carries the settings-level read
    // gate. There is no draft state in this model — an entry is public the
    // moment it is recorded — so the reason to restrict the menu is what the
    // page EXPOSES: the internal `reason` of every ledger entry and the name of
    // the staff member who filed it, neither of which appears publicly.
    // Recording is ADMIN-only inside the page, and the route itself is guarded
    // (see AuthGuard.test.tsx) — this only controls menu noise.
    test('Keuangan > Cadangan & Atestasi visible to ADMIN and DEVELOPER, hidden for STAFF and MANAGER', () => {
      const { unmount: unmountAdmin } = renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true, // ADMIN
      })
      expect(
        screen.getByRole('link', { name: /^cadangan & atestasi$/i })
      ).toHaveAttribute('href', '/transparency')
      unmountAdmin()

      // The half the old version of this test never actually checked, despite
      // its name.
      const { unmount: unmountDev } = renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_3', // Marcus Aurelius, DEVELOPER
      })
      expect(
        screen.getByRole('link', { name: /^cadangan & atestasi$/i })
      ).toHaveAttribute('href', '/transparency')
      unmountDev()

      const { unmount: unmountStaff } = renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // STAFF role
      })
      expect(
        screen.queryByRole('link', { name: /^cadangan & atestasi$/i })
      ).not.toBeInTheDocument()
      unmountStaff()

      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_2', // Linda Chen, MANAGER
      })
      expect(
        screen.queryByRole('link', { name: /^cadangan & atestasi$/i })
      ).not.toBeInTheDocument()
    })

    // USDX-87: Manual Sync is an emergency recovery surface — every role
    // (incl. STAFF who has no Settings access) must see it.
    test('Perbaiki Status Nyangkut visible to STAFF role', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // STAFF role
      })
      const link = screen.getByRole('link', { name: /^perbaiki status nyangkut$/i })
      expect(link).toHaveAttribute('href', '/manual-sync')
      // Naik ke "Pekerjaan Hari Ini": memperbaiki request yang nyangkut memang
      // pekerjaan, dan "Troubleshooting" bukan kelompok yang berarti buat operator.
      expect(screen.getByText(/^pekerjaan hari ini$/i)).toBeInTheDocument()
    })
  })

  describe('badge counter (sot/phase-1.md § Sidebar)', () => {
    test('shows (N) badge on Mint when there are PENDING_APPROVAL requests', async () => {
      server.use(
        http.get('/api/v1/requests', ({ request }) => {
          const url = new URL(request.url)
          const type = url.searchParams.get('type')
          const status = url.searchParams.get('status')
          if (type === 'mint' && status === 'PENDING_APPROVAL') {
            return HttpResponse.json({
              status: 'success',
              metadata: { page: 1, limit: 1, total: 7 },
              data: [],
            })
          }
          return HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 1, total: 0 },
            data: [],
          })
        })
      )
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const badge = await screen.findByTestId('nav-badge-mint')
      expect(badge).toHaveTextContent('7')
    })

    test('hides badge entirely when count is 0', async () => {
      server.use(
        http.get('/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 1, total: 0 },
            data: [],
          })
        )
      )
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      // Wait for the query to resolve, then assert no badge testid is present.
      // queryByTestId is sufficient because the badge node only renders when
      // the count is > 0 (per Linear AC: hide angka, label saja saat 0).
      expect(screen.queryByTestId('nav-badge-mint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('nav-badge-burn')).not.toBeInTheDocument()
    })
  })

  // USDX-678 — badge Persetujuan Pencairan (USDX-669) dan Pencairan Bermasalah (USDX-662)
  // dibaca dari `GET /api/v1/queue-counts`, BUKAN dari list `take=1`: list keduanya
  // mendekripsi rekening dan menulis `pii_access_audit` per baris (sot/api/queue-counts.yaml).
  // Kedua antrean terbuka untuk SEMUA peran, jadi badge-nya juga — berbeda dari Mint/Burn.
  describe('USDX-678 — badge antrean dari queue-counts', () => {
    function queueCounts(data: {
      payoutFailuresOpen: number
      redeemApprovalsOpen: number
      heldCreditsOpen?: number
      approvalsOpen?: number
    }) {
      return http.get('/api/v1/queue-counts', () =>
        HttpResponse.json({ status: 'success', metadata: null, data })
      )
    }

    function recordRequests() {
      const calls: string[] = []
      server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url)
        calls.push(url.pathname + url.search)
      })
      return calls
    }

    afterEach(() => server.events.removeAllListeners())

    describe('positive', () => {
      test('shows payoutFailuresOpen and redeemApprovalsOpen on their entries', async () => {
        server.use(queueCounts({ payoutFailuresOpen: 3, redeemApprovalsOpen: 4 }))
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        expect(await screen.findByTestId('nav-badge-payout-failures')).toHaveTextContent('3')
        expect(await screen.findByTestId('nav-badge-redeem-approvals')).toHaveTextContent('4')
      })

      // Dua antrean kerja lainnya. Angkanya datang dari permintaan queue-counts
      // YANG SAMA — empat badge, satu request.
      test('shows heldCreditsOpen and approvalsOpen on their entries', async () => {
        server.use(
          queueCounts({
            payoutFailuresOpen: 1,
            redeemApprovalsOpen: 1,
            heldCreditsOpen: 7,
            approvalsOpen: 2,
          })
        )
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        expect(await screen.findByTestId('nav-badge-mint-bermasalah')).toHaveTextContent('7')
        expect(await screen.findByTestId('nav-badge-persetujuan')).toHaveTextContent('2')
      })

      // Backend yang belum naik: kedua kunci ABSEN dari jawaban. Keduanya dibaca
      // `?? 0`, jadi badge-nya tidak dirender dan menunya tetap jalan — berkurang,
      // bukan rusak. Kalau ini kelak jadi `NaN` atau `undefined` di layar, di
      // sinilah ketahuannya.
      test('hitungan yang GAGAL dirender "belum terbaca", bukan disembunyikan', async () => {
        // Sebelumnya `?? 0`, jadi query yang gagal membuat badge-nya tidak muncul
        // sama sekali — antrean rupiah tertahan terlihat persis seperti antrean
        // yang bersih. Beranda (`QueueBoard`) sudah menangani query YANG SAMA
        // dengan benar ("Belum terbaca"); sidebar yang bertentangan dengan Beranda
        // pada satu kegagalan identik adalah layar yang tidak bisa dipercaya.
        server.use(
          http.get('/api/v1/queue-counts', () =>
            HttpResponse.json(
              { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
              { status: 500 }
            )
          )
        )
        renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'], authenticated: true })

        // Keempat antrean yang angkanya datang dari queue-counts menandai dirinya.
        for (const rute of ['payout-failures', 'redeem-approvals', 'mint-bermasalah', 'persetujuan']) {
          expect(await screen.findByTestId(`nav-badge-${rute}-galat`)).toBeInTheDocument()
          // Dan TIDAK mengklaim angka apa pun.
          expect(screen.queryByTestId(`nav-badge-${rute}`)).not.toBeInTheDocument()
        }
        expect(
          (await screen.findAllByLabelText('Jumlah antrean belum terbaca')).length
        ).toBeGreaterThanOrEqual(4)
      })

      // Backend yang belum naik: kedua kunci ABSEN dari jawaban — persis keadaan
      // `origin/dev` hari ini, yang hanya mengirim dua kunci lama.
      //
      // Membacanya `?? 0` akan membuat "Mint Bermasalah" dan "Persetujuan Orang
      // Kedua" menampilkan antrean bersih SECARA PERMANEN sampai branch backend
      // naik. Itu bukan fitur yang berkurang, itu sinyal yang berbohong — dan di
      // Mint Bermasalah satuannya rupiah nasabah yang tertahan. Jadi kunci yang
      // hilang diperlakukan sama dengan hitungan yang gagal: belum terbaca.
      test('kunci yang belum ada di backend dirender "belum terbaca", bukan nol', async () => {
        server.use(queueCounts({ payoutFailuresOpen: 3, redeemApprovalsOpen: 4 }))
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        expect(await screen.findByTestId('nav-badge-payout-failures')).toHaveTextContent('3')
        expect(screen.getByTestId('nav-badge-redeem-approvals')).toHaveTextContent('4')
        expect(screen.getByTestId('nav-badge-mint-bermasalah-galat')).toBeInTheDocument()
        expect(screen.getByTestId('nav-badge-persetujuan-galat')).toBeInTheDocument()
        expect(screen.queryByTestId('nav-badge-mint-bermasalah')).not.toBeInTheDocument()
        expect(screen.queryByTestId('nav-badge-persetujuan')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Mint Bermasalah/ })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Persetujuan Orang Kedua/ })).toBeInTheDocument()
      })

      test('reads both badges from ONE queue-counts request and never pulls the lists', async () => {
        const calls = recordRequests()
        server.use(queueCounts({ payoutFailuresOpen: 1, redeemApprovalsOpen: 2 }))
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        await screen.findByTestId('nav-badge-redeem-approvals')
        expect(calls.filter((c) => c.startsWith('/api/v1/queue-counts'))).toEqual(['/api/v1/queue-counts'])
        expect(calls.some((c) => c.startsWith('/api/v1/payout-failures'))).toBe(false)
        expect(calls.some((c) => c.startsWith('/api/v1/redeem-approvals'))).toBe(false)
      })

      // § 4 P2-1 memindahkannya dari TREASURY ke "Pekerjaan Hari Ini". Yang
      // DIJAGA keputusan PM 2026-09-13 (`sot/bni-integration.md § 17.9`) bukan
      // nama sectionnya melainkan ketetanggaannya dengan antrean penyelesaian
      // uang yang lain — jadi itu yang diuji di sini.
      // CATATAN: pindah section ini masih menunggu sign-off PM.
      test('Pencairan Bermasalah duduk berdampingan dengan Persetujuan Pencairan', async () => {
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        const link = await screen.findByRole('link', { name: /pencairan bermasalah/i })
        const section = link.closest('div.flex.flex-col')
        expect(section).not.toBeNull()
        expect(section!.firstElementChild).toHaveTextContent(/pekerjaan hari ini/i)
        expect(section!).toHaveTextContent(/persetujuan pencairan/i)
      })
    })

    describe('negative', () => {
      test('hides the badge of an empty queue while the other queue still shows its count', async () => {
        server.use(queueCounts({ payoutFailuresOpen: 0, redeemApprovalsOpen: 7 }))
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        // Badge yang TAMPIL membuktikan jawaban queue-counts sudah mendarat — tanpa itu
        // "tidak ada badge" lolos juga sebelum request selesai.
        expect(await screen.findByTestId('nav-badge-redeem-approvals')).toHaveTextContent('7')
        expect(screen.queryByTestId('nav-badge-payout-failures')).not.toBeInTheDocument()
      })

      test('a failing queue-counts request shows no badge instead of a made-up number', async () => {
        const calls = recordRequests()
        const settled: string[] = []
        server.events.on('response:mocked', ({ request }) => {
          settled.push(new URL(request.url).pathname)
        })
        server.use(
          http.get('/api/v1/queue-counts', () =>
            HttpResponse.json(
              { status: 'error', metadata: null, data: null, error: { code: 'INTERNAL_ERROR', message: 'boom' } },
              { status: 500 }
            )
          )
        )
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        // Tunggu jawaban 500-nya benar-benar mendarat, lalu beri React satu putaran render.
        await waitFor(() => expect(settled).toContain('/api/v1/queue-counts'))
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(screen.queryByTestId('nav-badge-payout-failures')).not.toBeInTheDocument()
        expect(screen.queryByTestId('nav-badge-redeem-approvals')).not.toBeInTheDocument()
        // Tidak ada jalan pintas kembali ke list yang mendekripsi PII saat hitungan gagal.
        expect(calls.some((c) => c.startsWith('/api/v1/payout-failures'))).toBe(false)
        expect(calls.some((c) => c.startsWith('/api/v1/redeem-approvals'))).toBe(false)
      })
    })

    describe('edge cases', () => {
      test('renders both entries and badges for STAFF too — the queues are readable by every role', async () => {
        server.use(queueCounts({ payoutFailuresOpen: 5, redeemApprovalsOpen: 2 }))
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          staffId: 'stf_4', // STAFF
        })
        expect(await screen.findByTestId('nav-badge-payout-failures')).toHaveTextContent('5')
        expect(await screen.findByTestId('nav-badge-redeem-approvals')).toHaveTextContent('2')
        expect(screen.getByRole('link', { name: /pencairan bermasalah/i })).toHaveAttribute(
          'href',
          '/payout-failures'
        )
        expect(screen.getByRole('link', { name: /persetujuan pencairan/i })).toHaveAttribute(
          'href',
          '/redeem-approvals'
        )
      })

      test('caps a large count at 99+', async () => {
        server.use(queueCounts({ payoutFailuresOpen: 140, redeemApprovalsOpen: 0 }))
        renderWithProviders(<Sidebar />, {
          initialEntries: ['/dashboard'],
          authenticated: true,
        })
        expect(await screen.findByTestId('nav-badge-payout-failures')).toHaveTextContent('99+')
      })
    })
  })

  // USDX-78 — STAFF can't access /mint /burn lists (sot/phase-1.md L34 +
  // L653-655). Sidebar redirects Mint/Burn straight to the form and hides
  // the (N) badge so STAFF doesn't see a counter they can't act on.
  describe('USDX-78 — STAFF sidebar', () => {
    test('STAFF Mint OTC link targets /mint/new instead of /mint', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // Sarah King (STAFF)
      })
      const mintLink = screen.getByRole('link', { name: /^mint otc$/i })
      expect(mintLink).toHaveAttribute('href', '/mint/new')
    })

    test('STAFF Burn OTC link targets /burn/new instead of /burn', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4',
      })
      const burnLink = screen.getByRole('link', { name: /^burn otc$/i })
      expect(burnLink).toHaveAttribute('href', '/burn/new')
    })

    test('STAFF never sees the Mint/Burn (N) badge', async () => {
      // Even if a stale handler returned a count, the Sidebar disables the
      // count query for STAFF and never renders a badge.
      server.use(
        http.get('/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 1, total: 99 },
            data: [],
          })
        )
      )
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4',
      })
      expect(screen.queryByTestId('nav-badge-mint')).not.toBeInTheDocument()
      expect(screen.queryByTestId('nav-badge-burn')).not.toBeInTheDocument()
    })
  })

  // Sidebar outgrew the viewport once the Reporting + Troubleshooting sections
  // landed, and MainLayout clips overflow (h-screen overflow-hidden) — so the
  // nav itself must scroll. jsdom performs no layout, so guard the classes
  // that make it scrollable (min-h-0 lets the flex child shrink below its
  // content height; without it overflow-y-auto never engages).
  describe('scrollable nav (sidebar taller than viewport)', () => {
    test('nav scrolls independently of the pinned header/footer', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    })
  })

  // USDX-154 — entri KYC + badge (N). Visible to every role
  // (week1.md § Authorization Guard: list is Admin/Manager/Staff/Developer);
  // unlike Mint/Burn the badge also renders for STAFF.
  // § 4 P2-1: section "Compliance" jadi "Nasabah" dan label menunya dibuka
  // kepanjangannya — "KYC Review" → "Verifikasi Perorangan" — karena petugas
  // yang membacanya bukan orang crypto. MUATAN layarnya tidak disentuh: audit
  // ke kontrak SOT (§ 3.6) menunjukkan hampir seluruhnya terkunci POJK 8/2023.
  describe('USDX-154 — Nasabah / Verifikasi Perorangan', () => {
    function kycCount(total: number) {
      return http.get('/api/v1/kyc', () =>
        HttpResponse.json({
          status: 'success',
          metadata: { page: 1, limit: 1, total },
          data: [],
        })
      )
    }

    test('renders section Nasabah with a Verifikasi Perorangan link to /kyc (admin)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.queryByText(/compliance/i)).not.toBeInTheDocument()
      const link = screen.getByRole('link', { name: /^verifikasi perorangan$/i })
      expect(link).toHaveAttribute('href', '/kyc')
    })

    test('shows (N) badge with the PENDING submission count', async () => {
      server.use(kycCount(5))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const badge = await screen.findByTestId('nav-badge-kyc')
      expect(badge).toHaveTextContent('5')
    })

    test('hides the badge when the PENDING count is 0', async () => {
      server.use(kycCount(0))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      // Link renders; badge node only mounts when count > 0.
      await screen.findByRole('link', { name: /^verifikasi perorangan$/i })
      expect(screen.queryByTestId('nav-badge-kyc')).not.toBeInTheDocument()
    })

    test('STAFF sees Verifikasi Perorangan with the badge (list is staff-accessible, unlike /mint)', async () => {
      server.use(kycCount(3))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // Sarah King (STAFF)
      })
      const link = screen.getByRole('link', { name: /^verifikasi perorangan$/i })
      expect(link).toHaveAttribute('href', '/kyc')
      const badge = await screen.findByTestId('nav-badge-kyc')
      expect(badge).toHaveTextContent('3')
    })

    test('DEVELOPER sees Verifikasi Perorangan (view-only role still gets the list menu)', async () => {
      server.use(kycCount(2))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_3', // Marcus Aurelius (DEVELOPER)
      })
      expect(screen.getByRole('link', { name: /^verifikasi perorangan$/i })).toBeInTheDocument()
      const badge = await screen.findByTestId('nav-badge-kyc')
      expect(badge).toHaveTextContent('2')
    })
  })

  // USDX-546 — KYB Review joins the same COMPLIANCE group, with the same
  // visibility rule as KYC Review (all roles read; acting is gated inside the
  // detail). Its own entry rather than a tab under KYC: the two carry different
  // data and KYB additionally has a manual data-entry form.
  describe('USDX-546 — Nasabah / Verifikasi Badan Usaha', () => {
    function kybCount(total: number) {
      return http.get('/api/v1/kyb', () =>
        HttpResponse.json({
          status: 'success',
          metadata: { page: 1, limit: 1, total },
          data: [],
        })
      )
    }

    // `/api/v1/kyb` is real-backend-only now — its MSW handler was deleted with
    // USDX-546 — so the badge query has nothing to answer it unless a test says
    // so. Stub zero by default; the tests that care about the number override it.
    beforeEach(() => {
      server.use(kybCount(0))
    })

    test('renders a Verifikasi Badan Usaha link to /kyb (admin)', () => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.getByRole('link', { name: /^verifikasi badan usaha$/i })).toHaveAttribute(
        'href',
        '/kyb'
      )
    })

    test('shows (N) badge with the PENDING record count', async () => {
      server.use(kybCount(4))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const badge = await screen.findByTestId('nav-badge-kyb')
      expect(badge).toHaveTextContent('4')
    })

    test('hides the badge when the PENDING count is 0', async () => {
      server.use(kybCount(0))
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      await screen.findByRole('link', { name: /^verifikasi badan usaha$/i })
      expect(screen.queryByTestId('nav-badge-kyb')).not.toBeInTheDocument()
    })

    test.each([
      ['STAFF', 'stf_4'],
      ['MANAGER', 'stf_2'],
      ['DEVELOPER', 'stf_3'],
    ])('%s also sees Verifikasi Badan Usaha', (_role, staffId) => {
      renderWithProviders(<Sidebar />, {
        initialEntries: ['/dashboard'],
        staffId,
      })
      expect(screen.getByRole('link', { name: /^verifikasi badan usaha$/i })).toBeInTheDocument()
    })
  })
})
