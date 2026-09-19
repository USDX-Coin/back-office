import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import Navbar from '@/components/layout/Navbar'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// Navbar renders the mobile MobileNavDrawer, whose pending-count hooks hit the
// API — keep the mock server up so those queries resolve cleanly.
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Navbar', () => {
  describe('breadcrumb', () => {
    // § 4 P2-1 + P1-4 — nama section/menu berbahasa Indonesia, dan peta
    // breadcrumb diperluas dari 12 rute ke seluruh rute bermenu. Sebelumnya
    // `/redeem-approvals` terbaca "USDX › redeem-approvals" dan
    // `/reports/mint/daily` terbaca "reports › mint › daily" — semua halaman
    // uang yang paling baru justru yang tidak punya breadcrumb.
    test('should render Pekerjaan Hari Ini / Beranda for /dashboard', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByText('Pekerjaan Hari Ini')).toBeInTheDocument()
      expect(screen.getByText('Beranda')).toBeInTheDocument()
    })

    test('should render Meja OTC / Mint OTC for /mint', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/mint'], authenticated: true })
      expect(screen.getByText('Meja OTC')).toBeInTheDocument()
      expect(screen.getByText('Mint OTC')).toBeInTheDocument()
    })

    test('should render Meja OTC / Mint OTC baru for /mint/new', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/mint/new'], authenticated: true })
      expect(screen.getByText('Meja OTC')).toBeInTheDocument()
      expect(screen.getByText('Mint OTC baru')).toBeInTheDocument()
    })

    test('should render Pengaturan / Batas Safe Manager for /settings/threshold', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/settings/threshold'], authenticated: true })
      expect(screen.getByText('Pengaturan')).toBeInTheDocument()
      expect(screen.getByText('Batas Safe Manager')).toBeInTheDocument()
    })

    test('should render Nasabah / Nasabah for /users', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/users'], authenticated: true })
      expect(screen.getAllByText('Nasabah')).toHaveLength(2)
    })

    // P1-4 — rute-rute uang yang dulu jatuh ke potongan URL mentah.
    test.each([
      ['/redeem-approvals', 'Pekerjaan Hari Ini', 'Persetujuan Pencairan'],
      ['/payout-failures', 'Pekerjaan Hari Ini', 'Pencairan Bermasalah'],
      ['/manual-sync', 'Pekerjaan Hari Ini', 'Perbaiki Status Nyangkut'],
      ['/multisig', 'Keuangan', 'Antrean Tanda Tangan'],
      ['/bni-accounts', 'Keuangan', 'Rekening BNI'],
      ['/reports/mint/daily', 'Laporan', 'Mint Harian'],
      ['/screening', 'Nasabah', 'Pemeriksaan Daftar Sanksi'],
      ['/settings/oncall', 'Pengaturan', 'Kontak Darurat'],
    ])('maps %s to a named breadcrumb instead of raw URL segments', (path, head, tail) => {
      renderWithProviders(<Navbar />, { initialEntries: [path], authenticated: true })
      expect(screen.getByText(head)).toBeInTheDocument()
      expect(screen.getByText(tail)).toBeInTheDocument()
    })

    test('should fall back to raw path segments for unknown routes', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/unknown-route'], authenticated: true })
      expect(screen.getByText('unknown-route')).toBeInTheDocument()
    })
  })

  describe('chrome', () => {
    // P0-4 — tes ini DULU mengunci keberadaan "kotak cari" palsu: sebuah <div>
    // berisi teks "Search…" dan lencana ⌘K, tanpa input, tanpa handler, dan
    // tanpa command palette di mana pun di repo. Tesnya sendiri menyebutnya
    // "static affordance, not an input" — artinya ia mengunci sebuah kontrol
    // yang tidak bisa diklik. Sekarang ia mengunci ketiadaannya.
    //
    // Penggantinya bukan command palette melainkan tautan antar layar
    // (P0-2/P0-3). Kotak cari NYATA di /transactions menunggu parameter
    // `search` di `sot/api/orders.yaml`, yang belum ada — dan kotak cari yang
    // menyaring di sisi klien atas daftar yang dipaginasi server akan
    // menyembunyikan baris di halaman lain.
    test('should NOT render a fake search affordance', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.queryByText('⌘K')).not.toBeInTheDocument()
      expect(screen.queryByText(/^search…?$/i)).not.toBeInTheDocument()
    })

    test('should render USDX wordmark on mobile', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      // Wordmark renders as a <span>USDX</span> next to a "U" tile (not an <img>)
      expect(screen.getByText('USDX')).toBeInTheDocument()
    })

    test('should render a hamburger that opens the mobile nav drawer (USDX-27)', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
      expect(hamburger).toBeInTheDocument()
      // Drawer is closed → no nav links yet.
      expect(screen.queryByRole('link', { name: /^mint otc$/i })).not.toBeInTheDocument()
      fireEvent.click(hamburger)
      expect(screen.getByRole('link', { name: /^mint otc$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })
  })

  describe('profile dropdown', () => {
    test('should render profile dropdown trigger when authenticated', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByText(/open profile menu/i)).toBeInTheDocument()
    })
  })
})
