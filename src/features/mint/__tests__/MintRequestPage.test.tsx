import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import MintRequestPage from '@/features/mint/MintRequestPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const VALID_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

function TestApp() {
  return (
    <Routes>
      <Route path="/mint" element={<MintRequestPage />} />
      <Route
        path="/requests"
        element={<div data-testid="requests-page">Requests landing</div>}
      />
    </Routes>
  )
}

function setup() {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/mint'],
    authenticated: true,
  })
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/user name/i), 'Manual Entry')
  await user.type(screen.getByLabelText(/user wallet address/i), VALID_ADDRESS)
  await user.type(screen.getByLabelText(/^amount$/i), '100')
  // Open the chain Select and pick polygon
  await user.click(screen.getByRole('combobox', { name: /chain/i }))
  await user.click(await screen.findByRole('option', { name: /polygon/i }))
}

describe('MintRequestPage', () => {
  describe('AC1: page renders', () => {
    test('should render the form with all required fields', () => {
      setup()
      expect(
        screen.getByRole('heading', { level: 1, name: /mint request/i })
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/user name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/user wallet address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^amount$/i)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /chain/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /submit mint request/i })
      ).toBeInTheDocument()
    })
  })

  describe('AC2: autocomplete from /api/v1/users', () => {
    test('should fetch and show matches when typing in user name', async () => {
      const user = userEvent.setup()
      setup()
      await user.type(screen.getByLabelText(/user name/i), 'Bruce')
      // Listbox appears with at least one option after debounce + fetch
      const listbox = await screen.findByRole(
        'listbox',
        { name: /matching users/i },
        { timeout: 3000 }
      )
      const options = await within(listbox).findAllByRole('option')
      expect(options.length).toBeGreaterThan(0)
      // At least one option's accessible text should mention Bruce
      expect(
        options.some((o) => /bruce/i.test(o.textContent ?? ''))
      ).toBe(true)
    })

    test('should hit GET /api/v1/users with the typed search param', async () => {
      const user = userEvent.setup()
      // Spy: capture every URL hit by the autocomplete fetch loop.
      const calls: string[] = []
      server.use(
        http.get('/api/v1/users', ({ request }) => {
          calls.push(request.url)
          return HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 8, total: 0 },
            data: [],
          })
        })
      )

      setup()
      await user.type(screen.getByLabelText(/user name/i), 'Bruce')

      await waitFor(
        () => {
          expect(calls.some((url) => url.includes('search=Bruce'))).toBe(true)
        },
        { timeout: 3000 }
      )
    })

    test('should fill userName but leave userAddress untouched on selection', async () => {
      const user = userEvent.setup()
      setup()
      await user.type(screen.getByLabelText(/user name/i), 'Bruce')
      const listbox = await screen.findByRole(
        'listbox',
        { name: /matching users/i },
        { timeout: 3000 }
      )
      const options = await within(listbox).findAllByRole('option')
      const target = options.find((o) => /bruce/i.test(o.textContent ?? ''))
      expect(target).toBeDefined()
      await user.click(within(target!).getByRole('button'))

      const nameInput = screen.getByLabelText(
        /user name/i
      ) as HTMLInputElement
      const addressInput = screen.getByLabelText(
        /user wallet address/i
      ) as HTMLInputElement
      await waitFor(() => {
        expect(nameInput.value).toMatch(/bruce/i)
      })
      // Linear AC #2 + SoT do not couple user selection to userAddress —
      // operator must enter the wallet address manually.
      expect(addressInput.value).toBe('')
    })
  })

  describe('AC3: empty submit', () => {
    test('should show a validation error for each required field', async () => {
      const user = userEvent.setup()
      setup()
      await user.click(
        screen.getByRole('button', { name: /submit mint request/i })
      )
      expect(
        await screen.findByText(/user name is required/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/wallet address is required/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/amount is required/i)).toBeInTheDocument()
      expect(screen.getByText(/chain is required/i)).toBeInTheDocument()
    })
  })

  describe('AC4: invalid address — client-side gate', () => {
    test('should block submission and show address error before API call', async () => {
      const user = userEvent.setup()

      // Spy on the network: the request must NOT reach this handler.
      let postCalled = false
      server.use(
        http.post('/api/v1/mint', () => {
          postCalled = true
          return HttpResponse.json(
            { status: 'success', metadata: null, data: {} },
            { status: 201 }
          )
        })
      )

      setup()
      await user.type(screen.getByLabelText(/user name/i), 'Manual Entry')
      await user.type(
        screen.getByLabelText(/user wallet address/i),
        '0xnot-an-address'
      )
      await user.type(screen.getByLabelText(/^amount$/i), '100')
      await user.click(screen.getByRole('combobox', { name: /chain/i }))
      await user.click(await screen.findByRole('option', { name: /polygon/i }))
      await user.click(
        screen.getByRole('button', { name: /submit mint request/i })
      )

      expect(
        await screen.findByText(/invalid evm address/i)
      ).toBeInTheDocument()
      expect(postCalled).toBe(false)
    })

    test('should also gate mixed-case wrong-checksum addresses', async () => {
      const user = userEvent.setup()

      let postCalled = false
      server.use(
        http.post('/api/v1/mint', () => {
          postCalled = true
          return HttpResponse.json(
            { status: 'success', metadata: null, data: {} },
            { status: 201 }
          )
        })
      )

      setup()
      await user.type(screen.getByLabelText(/user name/i), 'Manual Entry')
      // sot/conventions.md L114-115: validate checksum at input. Last char's
      // case is flipped from the canonical EIP-55 form below.
      await user.type(
        screen.getByLabelText(/user wallet address/i),
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD'
      )
      await user.type(screen.getByLabelText(/^amount$/i), '100')
      await user.click(screen.getByRole('combobox', { name: /chain/i }))
      await user.click(await screen.findByRole('option', { name: /polygon/i }))
      await user.click(
        screen.getByRole('button', { name: /submit mint request/i })
      )

      expect(
        await screen.findByText(/checksum/i)
      ).toBeInTheDocument()
      expect(postCalled).toBe(false)
    })
  })

  describe('AC5: valid submit', () => {
    test('should show submitting state then redirect to /requests', async () => {
      const user = userEvent.setup()
      // Slow the handler so the loading state is observable.
      server.use(
        http.post('/api/v1/mint', async () => {
          await new Promise((r) => setTimeout(r, 50))
          return HttpResponse.json(
            {
              status: 'success',
              metadata: null,
              data: {
                id: 'mint_test_1',
                type: 'mint',
                idempotencyKey: '0x' + 'a'.repeat(64),
                userId: 'usr_1',
                userName: 'Manual Entry',
                userAddress: VALID_ADDRESS,
                amount: '100',
                amountWei: '100000000000000000000',
                amountIdr: '1625000',
                rateUsed: '16250',
                chain: 'polygon',
                notes: null,
                safeType: 'STAFF',
                status: 'PENDING_APPROVAL',
                safeTxHash: null,
                onChainTxHash: null,
                createdBy: 'stf_1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
            { status: 201 }
          )
        })
      )

      setup()
      await fillValidForm(user)
      const submit = screen.getByRole('button', {
        name: /submit mint request/i,
      })
      await user.click(submit)

      // Loading state visible while the mutation is in flight
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submitting/i })).toHaveAttribute(
          'aria-busy',
          'true'
        )
      })

      // Then we end up on /requests
      expect(await screen.findByTestId('requests-page')).toBeInTheDocument()
    })

    test('should send a body matching sot/openapi.yaml CreateMintRequest', async () => {
      const user = userEvent.setup()
      let capturedBody: Record<string, unknown> | null = null
      server.use(
        http.post('/api/v1/mint', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            {
              status: 'success',
              metadata: null,
              data: {
                id: 'mint_test_2',
                type: 'mint',
                idempotencyKey: '0x' + 'b'.repeat(64),
                userId: 'usr_1',
                userName: 'Manual Entry',
                userAddress: VALID_ADDRESS,
                amount: '100',
                amountWei: '100000000',
                amountIdr: '1625000',
                rateUsed: '16250',
                chain: 'polygon',
                notes: null,
                safeType: 'STAFF',
                status: 'PENDING_APPROVAL',
                safeTxHash: null,
                onChainTxHash: null,
                createdBy: 'stf_1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
            { status: 201 }
          )
        })
      )

      setup()
      await fillValidForm(user)
      await user.click(
        screen.getByRole('button', { name: /submit mint request/i })
      )

      await waitFor(() => {
        expect(capturedBody).not.toBeNull()
      })
      // sot/openapi.yaml § CreateMintRequest required: userName, userAddress,
      // amount (string), chain. notes optional.
      expect(capturedBody).toMatchObject({
        userName: 'Manual Entry',
        userAddress: VALID_ADDRESS,
        amount: '100',
        chain: 'polygon',
      })
      // amount must be a string per SoT spec, not a number
      expect(typeof capturedBody!.amount).toBe('string')
    })
  })

  describe('AC6: 403 from API', () => {
    test('should display the role-insufficient error inline', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'ROLE_INSUFFICIENT',
                message:
                  'Your role cannot submit mint above the manager threshold.',
              },
            },
            { status: 403 }
          )
        )
      )

      setup()
      await fillValidForm(user)
      await user.click(
        screen.getByRole('button', { name: /submit mint request/i })
      )

      expect(
        await screen.findByText(/role cannot submit/i)
      ).toBeInTheDocument()
      // Stays on /mint, no redirect
      expect(screen.queryByTestId('requests-page')).not.toBeInTheDocument()
    })
  })

  describe('AC7: 400 from API', () => {
    test('should display the API validation message inline', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'amount exceeds the daily backend cap',
              },
            },
            { status: 400 }
          )
        )
      )

      setup()
      await fillValidForm(user)
      await user.click(
        screen.getByRole('button', { name: /submit mint request/i })
      )

      expect(
        await screen.findByText(/amount exceeds the daily backend cap/i)
      ).toBeInTheDocument()
      // Stays on /mint
      expect(screen.queryByTestId('requests-page')).not.toBeInTheDocument()
    })

    // USDX-40 AC #3 literal "Invalid address → error message dari API" —
    // covers the API path (USDX-11 AC #7) for an address that is *valid*
    // EIP-55 but the BE rejects (e.g. denylist, mismatch with seeded user).
    // Without this, the only address-error coverage is the client-side gate
    // (AC4 above), and the literal "from API" wording is unproven.
    test('should display the API error message when BE rejects a valid-format address', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'INVALID_ADDRESS',
                message: 'User address is not a valid EVM address',
              },
            },
            { status: 400 }
          )
        )
      )

      setup()
      await fillValidForm(user)
      await user.click(
        screen.getByRole('button', { name: /submit mint request/i })
      )

      expect(
        await screen.findByText(/user address is not a valid evm address/i)
      ).toBeInTheDocument()
      // Stays on /mint, no redirect
      expect(screen.queryByTestId('requests-page')).not.toBeInTheDocument()
    })
  })
})
