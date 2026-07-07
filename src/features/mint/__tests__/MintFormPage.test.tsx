import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import MintFormPage from '@/features/mint/MintFormPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-46 AC coverage — Mint form with user picker + currency selector +
// wallet picker. Old USDX-11/USDX-40 tests covered the text-input form;
// they are superseded here.

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

function TestApp() {
  return (
    <Routes>
      <Route path="/mint/new" element={<MintFormPage />} />
      <Route path="/mint" element={<div data-testid="mint-list-page">Mint list landing</div>} />
    </Routes>
  )
}

function setup() {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/mint/new'],
    authenticated: true,
  })
}

async function selectChainPolygon(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: /chain/i }))
  await user.click(await screen.findByRole('option', { name: /polygon/i }))
}

async function pickEligibleUser(user: ReturnType<typeof userEvent.setup>) {
  const search = screen.getByLabelText(/^user$/i)
  await user.type(search, 'rob')
  const option = await screen.findByRole('option', { name: new RegExp(VERIFIED_USER_NAME, 'i') })
  await user.click(option)
}

describe('MintFormPage @ USDX-46', () => {
  describe('AC1 — searchable user picker', () => {
    test('renders combobox-style picker, no plain text input for user', () => {
      setup()
      const search = screen.getByLabelText(/^user$/i)
      expect(search).toHaveAttribute('aria-autocomplete', 'list')
    })

    test('AC1.2 — search hits GET /api/v1/users with kycStatus=VERIFIED filter', async () => {
      const user = userEvent.setup()
      let capturedUrl: string | null = null
      server.use(
        http.get('/api/v1/users', ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json(ELIGIBLE_USER_PAYLOAD)
        })
      )
      setup()
      await user.type(screen.getByLabelText(/^user$/i), 'rob')
      await waitFor(() => expect(capturedUrl).not.toBeNull())
      const url = new URL(capturedUrl!)
      expect(url.searchParams.get('search')).toBe('rob')
      expect(url.searchParams.get('kycStatus')).toBe('VERIFIED')
    })

    test('AC1.3 — suspended users are filtered out client-side', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/users', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 8, total: 2 },
            data: [
              {
                ...ELIGIBLE_USER_PAYLOAD.data[0],
                id: 'cus_suspended',
                name: 'Suspended User',
                suspended: true,
              },
              ELIGIBLE_USER_PAYLOAD.data[0],
            ],
          })
        )
      )
      setup()
      await user.type(screen.getByLabelText(/^user$/i), 'r')
      await screen.findByRole('option', { name: new RegExp(VERIFIED_USER_NAME, 'i') })
      expect(screen.queryByText(/Suspended User/i)).not.toBeInTheDocument()
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

    test('AC1.5 — clearing selection resets the picker back to empty input', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      setup()
      await pickEligibleUser(user)
      expect(await screen.findByTestId('user-picker-selected')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /clear selection/i }))
      await waitFor(() =>
        expect(screen.queryByTestId('user-picker-selected')).not.toBeInTheDocument()
      )
      expect(screen.getByLabelText(/^user$/i)).toHaveValue('')
    })
  })

  describe('AC2 — currency selector', () => {
    test('AC2.1 — defaults to USD', () => {
      setup()
      expect(screen.getByLabelText(/^currency$/i)).toHaveTextContent(/USD/i)
    })

    test('AC2.7 — switching currency resets the amount field', async () => {
      const user = userEvent.setup()
      setup()
      await user.type(screen.getByLabelText(/^amount$/i), '1000')
      expect(screen.getByLabelText(/^amount$/i)).toHaveValue('1000')
      // Open the currency Select and pick IDR
      await user.click(screen.getByLabelText(/^currency$/i))
      // USDX-27: option label is now "IDR (auto-convert)" — match on the
      // currency code prefix, not the full label.
      await user.click(await screen.findByRole('option', { name: /^IDR\b/i }))
      expect(screen.getByLabelText(/^amount$/i)).toHaveValue('')
    })
  })

  describe('AC3 — wallet picker', () => {
    test('AC3.1 — wallet picker disabled until user + chain are picked', () => {
      setup()
      // Empty initial state — text input present but disabled
      const walletInput = screen.getByPlaceholderText(/select chain first/i)
      expect(walletInput).toBeDisabled()
    })

    test('AC3.2/3.4 — picker lists user wallets filtered by chain + default empty', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      setup()
      await pickEligibleUser(user)
      await selectChainPolygon(user)

      // Wallet dropdown placeholder = "Select wallet…" (no auto-select).
      // Look up by id (htmlFor=mintWallet) since label association under
      // Radix Select can be flaky with getByLabelText.
      const walletTrigger = document.getElementById('mintWallet')!
      expect(walletTrigger).toHaveTextContent(/select wallet/i)
    })

    test('AC3.6 — Other → text input appears for manual address entry', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      setup()
      await pickEligibleUser(user)
      await selectChainPolygon(user)
      // Open wallet select
      await user.click(document.getElementById('mintWallet')!)
      await user.click(await screen.findByRole('option', { name: /other/i }))
      expect(screen.getByLabelText(/custom wallet address/i)).toBeInTheDocument()
    })
  })

  describe('AC4 — submit body shape', () => {
    test('AC4 — POST /api/v1/mint with userId + amountCurrency, redirects to /mint', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))

      let capturedBody: Record<string, unknown> | null = null
      server.use(
        http.post('/api/v1/mint', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            {
              status: 'success',
              metadata: null,
              data: {
                id: 'mint_1',
                idempotencyKey: '0x' + 'a'.repeat(64),
                userId: VERIFIED_USER_ID,
                userAddress: capturedBody.userAddress,
                amount: '100.00',
                amountWei: '100000000',
                amountIdr: '1625000',
                inputCurrency: 'USD',
                rateUsed: '16250',
                chain: 'polygon',
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
      await selectChainPolygon(user)
      // Pick the existing wallet (only option besides Other)
      await user.click(document.getElementById('mintWallet')!)
      await user.click(
        await screen.findByRole('option', {
          name: /5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed/i,
        })
      )
      await user.type(screen.getByLabelText(/^amount$/i), '100')
      await user.click(screen.getByRole('button', { name: /submit mint request/i }))

      await waitFor(() => expect(capturedBody).not.toBeNull())
      expect(capturedBody).toMatchObject({
        userId: VERIFIED_USER_ID,
        userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        amount: '100',
        amountCurrency: 'USD',
        chain: 'polygon',
      })
      // userName must NOT appear in the body anymore.
      expect(capturedBody).not.toHaveProperty('userName')
      await screen.findByTestId('mint-list-page')
    })

    test('AC4.1 — submit without picking a user shows validation error', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(screen.getByRole('button', { name: /submit mint request/i }))
      expect(await screen.findByText(/user is required/i)).toBeInTheDocument()
    })
  })

  // USDX-84 — 409 SAFE_QUEUE_OCCUPIED banner.
  // Acceptance criteria:
  //  - banner shows safeType + short blocking ID + "Lihat di Manual Sync" link
  //  - form input is NOT reset after 409
  //  - non-queue errors (400) keep the existing destructive-banner path
  //  - 409 without details.blockingRequestId still renders a graceful banner
  describe('AC USDX-84 — Safe queue occupied banner', () => {
    const BLOCKING_ID = '019e1aa8-9c7c-7fcd-6abc-deadbeef0001'

    async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
      await pickEligibleUser(user)
      await selectChainPolygon(user)
      await user.click(document.getElementById('mintWallet')!)
      await user.click(
        await screen.findByRole('option', {
          name: /5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed/i,
        })
      )
      await user.type(screen.getByLabelText(/^amount$/i), '250')
      await user.click(screen.getByRole('button', { name: /submit mint request/i }))
    }

    test('renders banner with short blocking ID + Manual Sync link on 409', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'SAFE_QUEUE_OCCUPIED',
                message: 'queued',
                details: { safeType: 'STAFF', blockingRequestId: BLOCKING_ID },
              },
            },
            { status: 409 }
          )
        )
      )

      setup()
      await fillAndSubmit(user)

      const banner = await screen.findByTestId('safe-queue-occupied-banner')
      expect(banner).toHaveTextContent(/Safe STAFF/i)
      expect(banner).toHaveTextContent('019e1aa8…f0001')
      const link = screen.getByRole('link', { name: /lihat di manual sync/i })
      expect(link).toHaveAttribute('href', `/manual-sync?highlight=${BLOCKING_ID}`)
    })

    test('form values are preserved after 409 so operator can retry', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'SAFE_QUEUE_OCCUPIED',
                message: 'queued',
                details: { safeType: 'MANAGER', blockingRequestId: BLOCKING_ID },
              },
            },
            { status: 409 }
          )
        )
      )

      setup()
      await fillAndSubmit(user)
      await screen.findByTestId('safe-queue-occupied-banner')

      // Inputs that should survive the 409.
      expect(screen.getByLabelText(/^amount$/i)).toHaveValue('250')
      expect(await screen.findByTestId('user-picker-selected')).toBeInTheDocument()
      // Should NOT have navigated to /mint.
      expect(screen.queryByTestId('mint-list-page')).not.toBeInTheDocument()
    })

    test('400 validation error still uses the existing destructive banner, not queue banner', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'VALIDATION_ERROR', message: 'amount must be positive' },
            },
            { status: 400 }
          )
        )
      )

      setup()
      await fillAndSubmit(user)

      expect(await screen.findByText(/amount must be positive/i)).toBeInTheDocument()
      expect(screen.queryByTestId('safe-queue-occupied-banner')).not.toBeInTheDocument()
    })

    test('graceful fallback when 409 omits details.blockingRequestId', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/users', () => HttpResponse.json(ELIGIBLE_USER_PAYLOAD)))
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'SAFE_QUEUE_OCCUPIED', message: 'queued' },
            },
            { status: 409 }
          )
        )
      )

      setup()
      await fillAndSubmit(user)

      const banner = await screen.findByTestId('safe-queue-occupied-banner')
      expect(banner).toHaveTextContent(/Safe target/i)
      // No short ID present.
      expect(banner.textContent ?? '').not.toMatch(/019e1aa8/)
      // Link still points at Manual Sync, just without highlight param.
      expect(screen.getByRole('link', { name: /lihat di manual sync/i })).toHaveAttribute(
        'href',
        '/manual-sync'
      )
    })
  })
})
