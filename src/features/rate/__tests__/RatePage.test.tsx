import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import RatePage from '@/features/rate/RatePage'
import { renderWithProviders } from '@/test/test-utils'
import { findStaffByEmail, findStaffById, issueMockJwt } from '@/mocks/handlers'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// Default-seeded staff (demo@usdx.io) is super_admin → maps to ADMIN.
// To exercise the read-only path we pre-populate localStorage with a
// staff whose role maps to STAFF before rendering. Session shape v3
// (token + staffId) matches what AuthProvider expects post-USDX-7.
function loginAsStaffRole(email: string) {
  const staff = findStaffByEmail(email)
  if (!staff) throw new Error(`Test fixture missing: ${email}`)
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({
      version: 3,
      staffId: staff.id,
      token: issueMockJwt(staff),
      issuedAt: Date.now(),
    })
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

// Mock-level auth gate sanity. Mirrors the SoT 403 branch on POST /api/v1/rate
// (sot/openapi.yaml L419–420) — backend rejects non-admin/manager. We exercise
// it directly against the MSW handler so coverage doesn't depend on the form
// (which already gates client-side).
describe('POST /api/v1/rate authorization (SoT 403)', () => {
  test('returns 403 with SoT ErrorResponse envelope when caller is not ADMIN/MANAGER', async () => {
    const staff = findStaffByEmail('marcus.a@usdx.io')! // compliance → STAFF
    const token = issueMockJwt(staff)
    const res = await fetch('/api/v1/rate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode: 'DYNAMIC', spreadPct: '0.5' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toMatchObject({
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'FORBIDDEN' },
    })
  })

  test('returns 401 when no Bearer token is sent', async () => {
    const res = await fetch('/api/v1/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'DYNAMIC' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  test('returns 201 + RateConfig when caller is ADMIN', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // super_admin → ADMIN
    const token = issueMockJwt(staff)
    const res = await fetch('/api/v1/rate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode: 'MANUAL', manualRate: '16400', spreadPct: '0.4' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.status).toBe('success')
    expect(body.data).toMatchObject({
      mode: 'MANUAL',
      manualRate: '16400',
      spreadPct: '0.4',
      updatedBy: staff.id,
    })
    expect(typeof body.data.id).toBe('string')
    expect(typeof body.data.createdAt).toBe('string')
  })
})

// Sanity check on the GET response shape — confirms the SoT envelope
// (status/metadata/data) is what the client receives.
describe('GET /api/v1/rate response shape', () => {
  test('returns RateInfo wrapped in SoT SuccessResponse envelope', async () => {
    const res = await fetch('/api/v1/rate')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('success')
    expect(body.metadata).toBeNull()
    expect(body.data).toMatchObject({
      rate: expect.stringMatching(/^\d+(\.\d+)?$/),
      mode: expect.stringMatching(/^(MANUAL|DYNAMIC)$/),
      spreadPct: expect.stringMatching(/^\d+(\.\d+)?$/),
      updatedAt: expect.any(String),
    })
  })
})
