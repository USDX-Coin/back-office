import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'

describe('Sidebar', () => {
  describe('positive', () => {
    test('should render all flat sidebar nav links', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      // Workspace section
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^user$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^staf$/i })).toBeInTheDocument()
      // OTC Desk section — Mint and Redeem are flat links (no collapsible group)
      expect(screen.getByRole('link', { name: /^mint$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^redeem$/i })).toBeInTheDocument()
      // Insights section
      expect(screen.getByRole('link', { name: /^requests$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^report$/i })).toBeInTheDocument()
    })

    test('should render section headers (Workspace / OTC Desk / Insights)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.getByText(/workspace/i)).toBeInTheDocument()
      expect(screen.getByText(/otc desk/i)).toBeInTheDocument()
      expect(screen.getByText(/insights/i)).toBeInTheDocument()
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
