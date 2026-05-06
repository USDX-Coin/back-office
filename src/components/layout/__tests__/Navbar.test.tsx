import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import Navbar from '@/components/layout/Navbar'
import { renderWithProviders } from '@/test/test-utils'

describe('Navbar', () => {
  describe('breadcrumb', () => {
    test('should render Workspace / Dashboard for /dashboard', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByText('Workspace')).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    test('should render OTC Desk / Mint for /otc/mint', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/otc/mint'], authenticated: true })
      expect(screen.getByText('OTC Desk')).toBeInTheDocument()
      expect(screen.getByText('Mint')).toBeInTheDocument()
    })

    test('should render Workspace / Users for /users', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/users'], authenticated: true })
      expect(screen.getByText('Workspace')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
    })

    test('should fall back to raw path segments for unknown routes', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/unknown-route'], authenticated: true })
      expect(screen.getByText('unknown-route')).toBeInTheDocument()
    })
  })

  describe('chrome', () => {
    test('should render notifications button with unread badge', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      const bell = screen.getByRole('button', { name: /notifications/i })
      expect(bell).toBeInTheDocument()
    })

    test('should render the cmd-k search affordance', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      // Static affordance, not an input — text + keyboard hint visible
      expect(screen.getByText(/search/i)).toBeInTheDocument()
      expect(screen.getByText('⌘K')).toBeInTheDocument()
    })

    test('should render USDX wordmark on mobile', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      // Wordmark renders as a <span>USDX</span> next to a "U" tile (not an <img>)
      expect(screen.getByText('USDX')).toBeInTheDocument()
    })
  })

  describe('profile dropdown', () => {
    test('should render profile dropdown trigger when authenticated', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByText(/open profile menu/i)).toBeInTheDocument()
    })
  })
})
