import { describe, test, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'

describe('Sidebar', () => {
  describe('positive', () => {
    test('should render the 5 top-level menu items', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^user$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^staf$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /otc/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^report$/i })).toBeInTheDocument()
    })

    test('should auto-expand OTC submenu when on /otc/* route', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/otc/mint'] })
      expect(screen.getByRole('link', { name: /^mint$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^redeem$/i })).toBeInTheDocument()
    })

    test('should toggle OTC submenu on click', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      const trigger = screen.getByRole('button', { name: /otc/i })
      expect(screen.queryByRole('link', { name: /^mint$/i })).not.toBeInTheDocument()
      fireEvent.click(trigger)
      expect(screen.getByRole('link', { name: /^mint$/i })).toBeInTheDocument()
    })

    test('should render System Status card with operational indicator', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.getByText(/system status/i)).toBeInTheDocument()
      expect(screen.getByText(/node operational/i)).toBeInTheDocument()
    })
  })

  describe('regression guards', () => {
    test('should NOT render Profile as a sidebar item (R8)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.queryByRole('link', { name: /profile/i })).not.toBeInTheDocument()
    })

    test('should NOT render Minting/Redeem as top-level items (replaced by OTC)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.queryByRole('link', { name: /^minting$/i })).not.toBeInTheDocument()
    })
  })
})
