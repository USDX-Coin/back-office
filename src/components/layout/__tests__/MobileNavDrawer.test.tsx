import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import MobileNavDrawer from '@/components/layout/MobileNavDrawer'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// USDX-27: the mobile bottom nav + "More" sheet were replaced by a single
// left-side drawer (opened by the Navbar hamburger) that mirrors the desktop
// Sidebar — same sections, same role gating.

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderOpen(onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...renderWithProviders(<MobileNavDrawer open onOpenChange={onOpenChange} />, {
      initialEntries: ['/dashboard'],
      authenticated: true,
    }),
  }
}

describe('MobileNavDrawer @ USDX-27', () => {
  describe('layout (admin)', () => {
    test('renders 4 section headers: Workspace / OTC / Settings / Troubleshooting', () => {
      renderOpen()
      expect(screen.getByText(/workspace/i)).toBeInTheDocument()
      expect(screen.getByText(/^otc$/i)).toBeInTheDocument()
      expect(screen.getByText(/settings/i)).toBeInTheDocument()
      // USDX-87: Manual Sync lives in its own Troubleshooting section.
      expect(screen.getByText(/troubleshooting/i)).toBeInTheDocument()
    })

    test('renders every admin nav link', () => {
      renderOpen()
      for (const name of [
        /dashboard/i,
        /^users$/i,
        /^staff$/i,
        /^mint$/i,
        /^burn$/i,
        /^rate$/i,
        /^threshold$/i,
        /manual sync/i,
      ]) {
        expect(screen.getByRole('link', { name })).toBeInTheDocument()
      }
    })

    test('renders the logout action', () => {
      renderOpen()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })
  })

  describe('interaction', () => {
    test('clicking a nav link closes the drawer', () => {
      const { onOpenChange } = renderOpen()
      fireEvent.click(screen.getByRole('link', { name: /^mint$/i }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('regression guards', () => {
    test('does not render removed entries (Requests / OTC splash / Notifications)', () => {
      renderOpen()
      const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
      expect(hrefs).not.toContain('/requests')
      expect(hrefs).not.toContain('/otc')
      expect(hrefs).not.toContain('/notifications')
    })
  })

  // USDX-78 — STAFF on mobile mirrors the desktop sidebar (sot/phase-1.md
  // L653-655): Mint/Burn target the form directly, no PENDING_APPROVAL badge.
  describe('USDX-78 — STAFF nav', () => {
    test('STAFF Mint and Burn target the form routes, no badge', () => {
      renderWithProviders(<MobileNavDrawer open onOpenChange={vi.fn()} />, {
        initialEntries: ['/dashboard'],
        staffId: 'stf_4', // Sarah King (STAFF)
      })
      expect(screen.getByRole('link', { name: /^mint$/i })).toHaveAttribute(
        'href',
        '/mint/new'
      )
      expect(screen.getByRole('link', { name: /^burn$/i })).toHaveAttribute(
        'href',
        '/burn/new'
      )
    })
  })
})
