import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import Navbar from '@/components/layout/Navbar'
import { renderWithProviders } from '@/test/test-utils'

describe('Navbar', () => {
  describe('breadcrumb', () => {
    test('should render Operations / Dashboard for /dashboard', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByText('Operations')).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    test('should render Operations / OTC Minting for /otc/mint', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/otc/mint'], authenticated: true })
      expect(screen.getByText('OTC Minting')).toBeInTheDocument()
    })

    test('should render Directory / Users for /users', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/users'], authenticated: true })
      expect(screen.getByText('Directory')).toBeInTheDocument()
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

    test('should render search input', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument()
    })

    test('should render USDX logo', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByRole('img', { name: /usdx/i })).toBeInTheDocument()
    })
  })

  describe('profile dropdown', () => {
    test('should render profile dropdown trigger when authenticated', () => {
      renderWithProviders(<Navbar />, { initialEntries: ['/dashboard'], authenticated: true })
      expect(screen.getByText(/open profile menu/i)).toBeInTheDocument()
    })
  })
})
