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

    test('should link segments that have a page, keep groups and the last segment as text', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/users/00000000-0000-0000-0000-000000000001'],
        authenticated: true,
      })
      const nav = screen.getByRole('navigation', { name: 'Lokasi halaman' })
      const links = Array.from(nav.querySelectorAll('a'))
      expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Daftar Nasabah', '/users']])
      expect(screen.getByText('Profil nasabah')).toHaveAttribute('aria-current', 'page')
      expect(screen.getByText('Nasabah').tagName).toBe('SPAN')
    })

    test('should link the parent page of a nested transaction queue', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/payout-failures/abc'], authenticated: true })
      const nav = screen.getByRole('navigation', { name: 'Lokasi halaman' })
      expect(Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual(['/transactions'])
    })

    test('should not link a menu page that is itself the current page', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/otc/mint'], authenticated: true })
      const nav = screen.getByRole('navigation', { name: 'Lokasi halaman' })
      expect(nav.querySelectorAll('a')).toHaveLength(0)
      expect(screen.getByText('Mint', { selector: '[aria-current="page"]' })).toBeInTheDocument()
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
      expect(screen.queryByRole('button', { name: /^OTC/ })).not.toBeInTheDocument()
      fireEvent.click(hamburger)
      expect(screen.getByRole('button', { name: /^OTC/ })).toBeInTheDocument()
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
