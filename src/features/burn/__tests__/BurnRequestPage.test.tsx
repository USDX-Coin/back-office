import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import BurnRequestPage from '@/features/burn/BurnRequestPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-46 AC coverage — Burn form parity with mint (user picker, currency
// selector, wallet picker) plus retained deposit/bank fields.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const VERIFIED_USER_ID = 'cus_3'
const VERIFIED_USER_NAME = 'Robert Deon'
const ELIGIBLE_USER_PAYLOAD = {
  status: 'success',
  metadata: { page: 1, limit: 8, total: 1 },
  data: [
    {
      id: VERIFIED_USER_ID,
      name: VERIFIED_USER_NAME,
      email: 'robert.deon@example.com',
      entityType: 'INDIVIDUAL',
      kycStatus: 'VERIFIED',
      suspended: false,
      notes: null,
      wallets: [
        {
          id: 'wal_seed_polygon',
          chain: 'polygon',
          address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
}

const VALID_TX = '0x' + 'b'.repeat(64)

function TestApp() {
  return (
    <Routes>
      <Route path="/burn" element={<BurnRequestPage />} />
      <Route path="/requests" element={<div data-testid="requests-page">Requests landing</div>} />
    </Routes>
  )
}

function setup() {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/burn'],
    authenticated: true,
  })
}

async function pickEligibleUser(user: ReturnType<typeof userEvent.setup>) {
  const search = screen.getByLabelText(/^user$/i)
  await user.type(search, 'rob')
  const option = await screen.findByRole('option', { name: new RegExp(VERIFIED_USER_NAME, 'i') })
  await user.click(option)
}

describe('BurnRequestPage @ USDX-46', () => {
  describe('AC1 — searchable user picker', () => {
    test('renders combobox-style picker (selection-required)', () => {
      setup()
      const search = screen.getByLabelText(/^user$/i)
      expect(search).toHaveAttribute('aria-autocomplete', 'list')
    })

    test('AC1.4 — picker rows display name + email', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      setup()
      await user.type(screen.getByLabelText(/^user$/i), 'rob')
      const option = await screen.findByRole('option', {
        name: new RegExp(VERIFIED_USER_NAME, 'i'),
      })
      expect(option.textContent).toMatch(/robert\.deon@example\.com/i)
    })
  })

  describe('AC5 — burn-only fields retained', () => {
    test('renders deposit tx hash + bank name + bank account', () => {
      setup()
      expect(screen.getByLabelText(/deposit tx hash/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/bank account/i)).toBeInTheDocument()
    })
  })

  describe('AC4 — submit body shape', () => {
    test('AC4 + AC5.2 — POST /api/v1/burn with userId + amountCurrency + bank fields', { timeout: 15000 }, async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))

      let capturedBody: Record<string, unknown> | null = null
      server.use(
        http.post('/api/v1/burn', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            {
              status: 'success',
              metadata: null,
              data: {
                id: 'burn_1',
                idempotencyKey: '0x' + 'a'.repeat(64),
                userId: VERIFIED_USER_ID,
                userAddress: capturedBody.userAddress,
                amount: '500.00',
                amountWei: '500000000',
                amountIdr: '8125000',
                inputCurrency: 'USD',
                rateUsed: '16250',
                chain: 'polygon',
                depositTxHash: VALID_TX,
                bankName: 'BCA',
                bankAccount: '1234567890',
                notes: null,
                safeType: 'STAFF',
                status: 'PENDING_APPROVAL',
                safeTxHash: '0x' + 'b'.repeat(64),
                onChainTxHash: null,
                createdBy: 'stf_1',
                createdAt: '2026-05-08T00:00:00Z',
                updatedAt: '2026-05-08T00:00:00Z',
              },
            },
            { status: 201 }
          )
        })
      )

      setup()
      await pickEligibleUser(user)
      // Polygon chain is preselected on burn form (single-chain Phase 1)
      // → wallet picker is enabled.
      await user.click(document.getElementById('burnWallet')!)
      await user.click(
        await screen.findByRole('option', {
          name: /5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed/i,
        })
      )
      await user.type(screen.getByLabelText(/^amount$/i), '500')
      await user.type(screen.getByLabelText(/deposit tx hash/i), VALID_TX)
      await user.type(screen.getByLabelText(/bank name/i), 'BCA')
      await user.type(screen.getByLabelText(/bank account/i), '1234567890')
      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => expect(capturedBody).not.toBeNull())
      expect(capturedBody).toMatchObject({
        userId: VERIFIED_USER_ID,
        userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        amount: '500',
        amountCurrency: 'USD',
        chain: 'polygon',
        depositTxHash: VALID_TX,
        bankName: 'BCA',
        bankAccount: '1234567890',
      })
      expect(capturedBody).not.toHaveProperty('userName')
      await screen.findByTestId('requests-page')
    })

    test('AC4.1 — submit without picking a user shows validation error', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /submit burn request/i }))
      expect(await screen.findByText(/user is required/i)).toBeInTheDocument()
    })
  })
})
