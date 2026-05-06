import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'

// USDX-39: AC #3 (role from /auth/me rendered in sidebar footer) is verified
// end-to-end via Playwright (`e2e/usdx-39.spec.ts`) since the AuthProvider
// now talks to the real BE.

describe('Sidebar', () => {
  describe('positive', () => {
    test('should render the top-level workspace, OTC, and insights items', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^users$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^mint$/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^redeem$/i })).toBeInTheDocument()
    })

    test('should NOT render legacy Staf entry (USDX-43)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(screen.queryByRole('link', { name: /^staf$/i })).not.toBeInTheDocument()
    })

    test('should render Requests entry pointing to /requests (USDX-39)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      const link = screen.getByRole('link', { name: /^requests$/i })
      expect(link).toHaveAttribute('href', '/requests')
    })
  })

  describe('regression guards', () => {
    test('should NOT render Profile as a sidebar item (R8)', () => {
      renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
      expect(
        screen.queryByRole('link', { name: /^profile$/i }),
      ).not.toBeInTheDocument()
    })
  })
})
