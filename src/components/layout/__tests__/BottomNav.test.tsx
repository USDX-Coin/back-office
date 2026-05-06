import { describe, test, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import BottomNav from '@/components/layout/BottomNav'
import { renderWithProviders } from '@/test/test-utils'

describe('BottomNav', () => {
  describe('positive', () => {
    test('should render 4 items: Dashboard, OTC, Report, More', () => {
      renderWithProviders(<BottomNav />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^otc$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^report$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /more menu/i })).toBeInTheDocument()
    })

    test('should open the More drawer with User/Staf/Profile/Logout', () => {
      renderWithProviders(<BottomNav />, { initialEntries: ['/dashboard'], authenticated: true })
      fireEvent.click(screen.getByRole('button', { name: /more menu/i }))
      expect(screen.getByRole('button', { name: /user.*customer directory/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /staf.*internal team/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /profile.*your account/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })
  })

  describe('regression guards', () => {
    test('should NOT render User/Staf/Profile as top-level bottom-nav items', () => {
      renderWithProviders(<BottomNav />, { initialEntries: ['/dashboard'], authenticated: true })
      // Only the OTC, Dashboard, Report are top-level <a> nav links + the More button.
      const links = screen.getAllByRole('link')
      const labels = links.map((l) => l.textContent?.trim().toLowerCase())
      expect(labels).not.toContain('user')
      expect(labels).not.toContain('staf')
      expect(labels).not.toContain('profile')
    })
  })
})
