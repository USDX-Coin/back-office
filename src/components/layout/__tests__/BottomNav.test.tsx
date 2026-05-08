import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import BottomNav from '@/components/layout/BottomNav'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// USDX-50: mobile bottom nav mirrors the new sidebar primary entries
// (Dashboard / Mint / Burn) plus a More drawer.

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('BottomNav @ USDX-50', () => {
  describe('positive', () => {
    test('renders 4 items: Dashboard, Mint, Burn, More', () => {
      renderWithProviders(<BottomNav />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^mint$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^burn$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /more menu/i })).toBeInTheDocument()
    })

    test('opens the More drawer with admin items', () => {
      renderWithProviders(<BottomNav />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      fireEvent.click(screen.getByRole('button', { name: /more menu/i }))
      expect(screen.getByRole('button', { name: /users.*customer directory/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /staff.*internal team/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /rate.*usd\/idr/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /threshold.*safe routing/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /profile.*your account/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })
  })

  describe('regression guards', () => {
    test('does not render removed entries (Requests, OTC splash, Notifications)', () => {
      renderWithProviders(<BottomNav />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const links = screen.getAllByRole('link')
      const hrefs = links.map((l) => l.getAttribute('href'))
      expect(hrefs).not.toContain('/requests')
      expect(hrefs).not.toContain('/otc')
      expect(hrefs).not.toContain('/notifications')
    })

    test('does not render Users/Staff/Profile as bottom-nav top-level links', () => {
      renderWithProviders(<BottomNav />, {
        initialEntries: ['/dashboard'],
        authenticated: true,
      })
      const links = screen.getAllByRole('link')
      const labels = links.map((l) => l.textContent?.trim().toLowerCase())
      expect(labels).not.toContain('users')
      expect(labels).not.toContain('staff')
      expect(labels).not.toContain('profile')
    })
  })
})
