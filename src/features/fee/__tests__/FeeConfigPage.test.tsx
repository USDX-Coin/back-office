import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import FeeConfigPage from '@/features/fee/FeeConfigPage'
import { renderWithProviders } from '@/test/test-utils'
import { findStaffByEmail, issueMockJwt } from '@/mocks/handlers'

// USDX-207 — Fee config page (sot/api/fee.yaml). Read = all backoffice roles,
// update = admin only. Mirrors the Rate page gating.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function loginAsStaffRole(email: string) {
  const staff = findStaffByEmail(email)
  if (!staff) throw new Error(`Test fixture missing: ${email}`)
  // USDX-392: v5 profile (no token) + session cookie for the mock's cookie gate.
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({ version: 5, staff, issuedAt: Date.now() }),
  )
  document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
  return staff
}

describe('FeeConfigPage @integration', () => {
  describe('AC: open /settings/fee shows current config', () => {
    test('shows mint / PG / redeem / disbursement fees from GET /api/v1/fee-config', async () => {
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByLabelText(/mint fee percent/i)).toHaveTextContent('1%')
      })
      expect(screen.getByLabelText(/pg fee va flat/i)).toHaveTextContent(/4\.000/)
      expect(screen.getByLabelText(/pg fee qris percent/i)).toHaveTextContent('0.7%')
      // Redeem fields (W3, USDX-245).
      expect(screen.getByLabelText(/redeem fee percent/i)).toHaveTextContent('1%')
      expect(screen.getByLabelText(/disbursement fee flat/i)).toHaveTextContent(/5\.000/)
    })
  })

  describe('AC: ADMIN sees update form', () => {
    test('renders the update form for the default ADMIN operator', async () => {
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      expect(
        await screen.findByRole('button', { name: /update fee config/i }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/your role does not have permission/i)).not.toBeInTheDocument()
    })
  })

  describe('AC: non-admin sees read-only view', () => {
    test('STAFF sees the read-only notice and no form', async () => {
      loginAsStaffRole('marcus.a@usdx.io') // compliance → STAFF
      renderWithProviders(<FeeConfigPage />)
      expect(
        await screen.findByText(/your role does not have permission/i),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /update fee config/i }),
      ).not.toBeInTheDocument()
    })

    test('current config card stays visible for non-editing roles', async () => {
      loginAsStaffRole('marcus.a@usdx.io')
      renderWithProviders(<FeeConfigPage />)
      await waitFor(() => {
        expect(screen.getByLabelText(/mint fee percent/i)).toBeInTheDocument()
      })
    })
  })

  describe('AC: update fee config → new active row', () => {
    test('full flow: edit mint fee, submit, see the new value in the card', async () => {
      const user = userEvent.setup()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })

      const mintInput = (await screen.findByLabelText(/^mint fee$/i)) as HTMLInputElement
      await waitFor(() => expect(mintInput.value).toBe('1.0'))

      await user.clear(mintInput)
      await user.type(mintInput, '2.5')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/mint fee percent/i)).toHaveTextContent('2.5%')
      })
    })

    test('blank mint fee blocks submit with a validation error', async () => {
      const user = userEvent.setup()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const mintInput = (await screen.findByLabelText(/^mint fee$/i)) as HTMLInputElement
      await waitFor(() => expect(mintInput.value).toBe('1.0'))
      await user.clear(mintInput)
      await user.click(screen.getByRole('button', { name: /update fee config/i }))
      expect(await screen.findByText(/mint fee is required/i)).toBeInTheDocument()
    })
  })
})

describe('POST /api/v1/fee-config authorization (sot/api/fee.yaml)', () => {
  test('403 with SoT ErrorResponse when caller is not ADMIN', async () => {
    const staff = findStaffByEmail('marcus.a@usdx.io')! // STAFF
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({ mintFeePct: '1.0', pgFeeVaFlat: '4000.00', pgFeeQrisPct: '0.7' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toMatchObject({ status: 'error', error: { code: 'FORBIDDEN' } })
  })

  test('401 when no Bearer token is sent', async () => {
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintFeePct: '1.0', pgFeeVaFlat: '4000.00', pgFeeQrisPct: '0.7' }),
    })
    expect(res.status).toBe(401)
  })

  test('201 + FeeConfig (full 5-field snapshot) when caller is ADMIN', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // super_admin → ADMIN
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({
        mintFeePct: '2.0',
        pgFeeVaFlat: '5000.00',
        pgFeeQrisPct: '0.8',
        redeemFeePct: '1.5',
        disbursementFeeFlat: '6000.00',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toMatchObject({
      mintFeePct: '2.0',
      pgFeeVaFlat: '5000.00',
      pgFeeQrisPct: '0.8',
      redeemFeePct: '1.5',
      disbursementFeeFlat: '6000.00',
      updatedBy: staff.id,
    })
    expect(typeof body.data.id).toBe('string')
  })

  // sot/conventions.md § Validation Error — fee-config is on the v1→422
  // allowlist, so body failures return 422 VALIDATION_ERROR (USDX-245).
  test('422 VALIDATION_ERROR when a redeem field is missing', async () => {
    const staff = findStaffByEmail('demo@usdx.io')!
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      // redeemFeePct + disbursementFeeFlat omitted → partial snapshot rejected.
      body: JSON.stringify({ mintFeePct: '2.0', pgFeeVaFlat: '5000.00', pgFeeQrisPct: '0.8' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body).toMatchObject({ status: 'error', error: { code: 'VALIDATION_ERROR' } })
  })
})

describe('GET /api/v1/fee-config response shape', () => {
  test('returns FeeConfig wrapped in the SoT SuccessResponse envelope', async () => {
    const res = await fetch('/api/v1/fee-config')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('success')
    expect(body.data).toMatchObject({
      mintFeePct: expect.stringMatching(/^\d+(\.\d+)?$/),
      pgFeeVaFlat: expect.stringMatching(/^\d+(\.\d+)?$/),
      pgFeeQrisPct: expect.stringMatching(/^\d+(\.\d+)?$/),
      // Redeem fields included in GET (W3, USDX-245) so the form pre-fills 5.
      redeemFeePct: expect.stringMatching(/^\d+(\.\d+)?$/),
      disbursementFeeFlat: expect.stringMatching(/^\d+(\.\d+)?$/),
    })
  })
})
