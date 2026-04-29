import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import Navbar from '@/components/layout/Navbar'
import { renderWithProviders } from '@/test/test-utils'

describe('Navbar', () => {
  describe('breadcrumb', () => {
    test('should render User > Internal for /user/internal', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/user/internal'],
        authenticated: true,
      })
      expect(screen.getByText('User')).toBeInTheDocument()
      expect(screen.getByText('Internal')).toBeInTheDocument()
    })

    test('should render OTC > Mint for /otc/mint', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/otc/mint'],
        authenticated: true,
      })
      expect(screen.getByText('OTC')).toBeInTheDocument()
      expect(screen.getByText('Mint')).toBeInTheDocument()
    })

    test('should render single-segment Report for /report', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/report'],
        authenticated: true,
      })
      expect(screen.getByText('Report')).toBeInTheDocument()
    })

    test('should title-case unknown segments', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/some-other-path'],
        authenticated: true,
      })
      expect(screen.getByText(/Some other path/i)).toBeInTheDocument()
    })
  })

  describe('chrome', () => {
    test('should render the sidebar trigger', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/user/internal'],
        authenticated: true,
      })
      // shadcn SidebarTrigger renders a button labeled "Toggle Sidebar"
      expect(
        screen.getByRole('button', { name: /toggle sidebar/i }),
      ).toBeInTheDocument()
    })

    test('should render the profile dropdown trigger when authenticated', () => {
      renderWithProviders(<Navbar />, {
        initialEntries: ['/user/internal'],
        authenticated: true,
      })
      expect(
        screen.getByRole('button', { name: /open profile menu/i }),
      ).toBeInTheDocument()
    })
  })
})
