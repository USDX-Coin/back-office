import { describe, test, expect } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/features/auth/LoginPage'
import { renderWithProviders } from '@/test/test-utils'

describe('LoginPage', () => {
  describe('positive', () => {
    test('should render the Masuk heading and required fields', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.getByRole('heading', { name: /^masuk$/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^kata sandi$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^masuk$/i })).toBeInTheDocument()
    })

    test('should toggle password visibility', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      const passwordInput = screen.getByLabelText(/^kata sandi$/i) as HTMLInputElement
      expect(passwordInput.type).toBe('password')
      fireEvent.click(screen.getByRole('button', { name: /tampilkan kata sandi/i }))
      expect(passwordInput.type).toBe('text')
    })

    test('should keep Remember-this-device toggle state', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      const checkbox = screen.getByRole('checkbox', { name: /ingat perangkat ini/i })
      expect(checkbox).toHaveAttribute('data-state', 'checked')
      fireEvent.click(checkbox)
      expect(checkbox).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('negative', () => {
    test('should show inline errors for empty submit', async () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      fireEvent.click(screen.getByRole('button', { name: /^masuk$/i }))
      await waitFor(() => {
        expect(screen.getByText(/email wajib diisi/i)).toBeInTheDocument()
        expect(screen.getByText(/kata sandi wajib diisi/i)).toBeInTheDocument()
      })
    })
  })

  describe('regression guards', () => {
    test('should NOT render a Forgot password link (R17)', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/lupa password/i)).not.toBeInTheDocument()
    })

    test('should NOT render a Register link (R17)', () => {
      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] })
      expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /daftar/i })).not.toBeInTheDocument()
    })
  })
})
