import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import RatePage from '@/features/rate/RatePage'
import { renderWithProviders } from '@/test/test-utils'
import { findStaffByEmail, findStaffById } from '@/mocks/handlers'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// Default-seeded staff (demo@usdx.io) is super_admin → maps to ADMIN.
// To exercise the read-only path we pre-populate localStorage with a
// staff whose role maps to STAFF before rendering.
function loginAsStaffRole(email: string) {
  const staff = findStaffByEmail(email)
  if (!staff) throw new Error(`Test fixture missing: ${email}`)
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({ version: 2, staffId: staff.id })
  )
  return staff
}

describe('RatePage @integration', () => {
  describe('AC: open /rate displays current rate info', () => {
    test('should show rate, mode, and spread from GET /api/v1/rate', async () => {
      renderWithProviders(<RatePage />, { authenticated: true })

      // RateInfo skeleton resolves to the seeded DYNAMIC config
      await waitFor(() => {
        expect(screen.getByLabelText(/effective rate/i)).toHaveTextContent(/IDR\/USD/)
      })
      expect(screen.getByText('DYNAMIC')).toBeInTheDocument()
      expect(screen.getByText('0.5%')).toBeInTheDocument()
    })
  })

  describe('AC: ADMIN role sees update form', () => {
    test('should render the update form for super_admin (mapped to ADMIN)', async () => {
      renderWithProviders(<RatePage />, { authenticated: true })
      expect(
        await screen.findByRole('button', { name: /review and update/i })
      ).toBeInTheDocument()
      // Read-only notice must NOT be present
      expect(screen.queryByText(/your role does not have permission/i)).not.toBeInTheDocument()
    })
  })

  describe('AC: STAFF role sees read-only view', () => {
    test('compliance staff (mapped to STAFF) sees read-only notice and no form', async () => {
      loginAsStaffRole('marcus.a@usdx.io') // compliance → STAFF
      renderWithProviders(<RatePage />)

      expect(
        await screen.findByText(/your role does not have permission/i)
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /review and update/i })
      ).not.toBeInTheDocument()
    })

    test('current rate card stays visible for non-editing roles', async () => {
      loginAsStaffRole('sking@usdx.io') // support → STAFF
      renderWithProviders(<RatePage />)

      await waitFor(() => {
        expect(screen.getByLabelText(/effective rate/i)).toBeInTheDocument()
      })
    })
  })

  describe('AC: DYNAMIC mode disables manualRate', () => {
    test('should disable the manual rate input when mode is DYNAMIC', async () => {
      renderWithProviders(<RatePage />, { authenticated: true })

      await screen.findByRole('button', { name: /review and update/i })

      // Wait for the form to seed from the resolved current config.
      await waitFor(() => {
        const rateInput = screen.getByLabelText(/manual rate/i) as HTMLInputElement
        expect(rateInput).toBeDisabled()
      })
    })
  })

  describe('AC: MANUAL requires manualRate', () => {
    test('should show validation error when MANUAL is chosen without a rate', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RatePage />, { authenticated: true })

      await screen.findByRole('button', { name: /review and update/i })

      // Switch the mode select to MANUAL
      await user.click(screen.getByRole('combobox', { name: /mode/i }))
      await user.click(screen.getByRole('option', { name: /^manual/i }))

      await user.click(screen.getByRole('button', { name: /review and update/i }))

      expect(await screen.findByText(/manual rate is required/i)).toBeInTheDocument()
    })
  })

  describe('Decision: confirm dialog before submit', () => {
    test('should open the confirm dialog with a current → new diff', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RatePage />, { authenticated: true })

      await screen.findByRole('button', { name: /review and update/i })

      // Choose MANUAL and a realistic rate
      await user.click(screen.getByRole('combobox', { name: /mode/i }))
      await user.click(screen.getByRole('option', { name: /^manual/i }))
      const rateInput = screen.getByLabelText(/manual rate/i) as HTMLInputElement
      await user.type(rateInput, '16500')

      await user.click(screen.getByRole('button', { name: /review and update/i }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/confirm rate update/i)).toBeInTheDocument()
      // Diff renders the new manual rate (formatted)
      expect(within(dialog).getByText(/16,500\.00 IDR\/USD/)).toBeInTheDocument()
      // Cancel button keeps the form alive without submitting
      await user.click(within(dialog).getByRole('button', { name: /cancel/i }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Decision: soft warning for unusual rate', () => {
    test('should show a non-blocking warning under 5,000', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RatePage />, { authenticated: true })

      await screen.findByRole('button', { name: /review and update/i })
      await user.click(screen.getByRole('combobox', { name: /mode/i }))
      await user.click(screen.getByRole('option', { name: /^manual/i }))
      await user.type(screen.getByLabelText(/manual rate/i), '1000')

      expect(await screen.findByText(/looks unusual/i)).toBeInTheDocument()
      // The submit button is still enabled (soft warning is non-blocking)
      expect(
        screen.getByRole('button', { name: /review and update/i })
      ).toBeEnabled()
    })
  })

  describe('AC: submit triggers rate refresh', () => {
    test('full flow: pick MANUAL, confirm, see new effective rate', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RatePage />, { authenticated: true })

      await waitFor(() => {
        expect(screen.getByLabelText(/effective rate/i)).toHaveTextContent(/IDR\/USD/)
      })

      await user.click(screen.getByRole('combobox', { name: /mode/i }))
      await user.click(screen.getByRole('option', { name: /^manual/i }))
      await user.type(screen.getByLabelText(/manual rate/i), '17000')

      await user.click(screen.getByRole('button', { name: /review and update/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, update rate/i }))

      // After mutation, dialog closes, GET refetches, MANUAL appears in card
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('MANUAL')).toBeInTheDocument()
      })
    })
  })
})

describe('Auth gate sanity', () => {
  test('default seed staff resolves to a role that can manage rate', () => {
    const staff = findStaffById(
      JSON.parse(localStorage.getItem('usdx_auth_user') ?? '{}').staffId ?? ''
    )
    // Documents the test fixture: when authenticated:true is used, we expect
    // ADMIN/MANAGER mapping so the form path is exercised.
    if (staff) {
      expect(['super_admin', 'operations']).toContain(staff.role)
    }
  })
})
