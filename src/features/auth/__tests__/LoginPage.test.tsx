import { describe, test, expect } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/features/auth/LoginPage'
import { renderWithProviders } from '@/test/test-utils'

describe('LoginPage', () => {
  describe('positive', () => {
    test('should render the Welcome back heading and required fields', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /secure login/i })).toBeInTheDocument()
    })

    test('should toggle password visibility', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement
      expect(passwordInput.type).toBe('password')
      fireEvent.click(screen.getByRole('button', { name: /show password/i }))
      expect(passwordInput.type).toBe('text')
    })

    test('should keep Remember-this-device toggle state', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      const checkbox = screen.getByRole('checkbox', { name: /remember this device/i })
      expect(checkbox).toHaveAttribute('data-state', 'checked')
      fireEvent.click(checkbox)
      expect(checkbox).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('negative', () => {
    test('should show inline errors for empty submit', async () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      fireEvent.click(screen.getByRole('button', { name: /secure login/i }))
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument()
        expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('regression guards', () => {
    test('should NOT render a Forgot password link (R17)', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument()
    })

    test('should NOT render a Register link (R17)', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument()
    })
  })
})
