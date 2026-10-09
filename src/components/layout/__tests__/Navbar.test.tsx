import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import Navbar from '@/components/layout/Navbar'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// Navbar renders the mobile drawer, whose count hooks hit the API — keep the
// mock server up so those queries resolve cleanly.
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function crumbs() {
  return screen.getByRole('navigation', { name: 'Lokasi halaman' }).textContent
}

describe('Navbar', () => {
  describe('breadcrumb', () => {
    test('should name the page from the menu table', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/settings/threshold'], authenticated: true })
      expect(crumbs()).toBe('PengaturanKurs & Biaya')
    })

    test('should never leak a UUID for a customer profile', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/users/00000000-0000-0000-0000-000000000001'],
        authenticated: true,
      })
      expect(crumbs()).toBe('NasabahDaftar NasabahProfil nasabah')
    })

    test('should fall back to "USDX", never to a raw slug', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/unknown-route'], authenticated: true })
      expect(crumbs()).toBe('USDX')
      expect(screen.queryByText('unknown-route')).not.toBeInTheDocument()
    })
  })

  describe('chrome', () => {
    // P0-4 — the old fake "Search… ⌘K" box stays gone.
    test('should NOT render a fake search affordance', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/transactions'], authenticated: true })
      expect(screen.queryByText('⌘K')).not.toBeInTheDocument()
      expect(screen.queryByText(/^search…?$/i)).not.toBeInTheDocument()
    })

    // Revisi PM 9 Okt 2026: logo asli (lockup koin + tulisan USDX dari
    // landing), bukan koin + teks serif buatan.
    test('should show the original USDX lockup on mobile, not a typed wordmark', () => {
      const { container } = renderWithProviders(<Navbar />, { initialEntries: ['/transactions'], authenticated: true })
      expect(container.querySelector('header img[src="/image/logo-lockup.png"]')).not.toBeNull()
      expect(screen.getByRole('img', { name: 'USDX' })).toBeInTheDocument()
      expect(screen.queryByText('USDX')).not.toBeInTheDocument()
    })

    test('should open the mobile nav drawer from the hamburger (USDX-27)', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/transactions'], authenticated: true })
      const hamburger = screen.getByRole('button', { name: /buka menu navigasi/i })
      expect(screen.queryByRole('link', { name: /^OTC/ })).not.toBeInTheDocument()
      fireEvent.click(hamburger)
      expect(screen.getByRole('link', { name: /^OTC/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /keluar/i })).toBeInTheDocument()
    })
  })

  describe('profile dropdown', () => {
    test('should render profile dropdown trigger when authenticated', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/transactions'], authenticated: true })
      expect(screen.getByText(/buka menu profil/i)).toBeInTheDocument()
    })
  })
})
