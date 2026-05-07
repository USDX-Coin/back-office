import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { getAddress } from 'viem'
import { server } from '@/mocks/server'
import {
  resetMockData,
  getDefaultStaff,
  issueMockJwt,
} from '@/mocks/handlers'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import BurnRequestPage from '@/features/burn/BurnRequestPage'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// Mounts /burn alongside a /requests sentinel route so we can assert the
// post-submit navigation (AC3) without leaving the test harness.
function renderBurnRoute(initialPath = '/burn') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  const staff = getDefaultStaff()!
  // sot/openapi.yaml § security: bearerAuth — handler now strictly verifies
  // the JWT, so seed the localStorage session with a real mock-signed JWT.
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({
      version: 4,
      staff,
      token: issueMockJwt(staff),
      issuedAt: Date.now(),
    })
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/burn" element={<BurnRequestPage />} />
              <Route
                path="/requests"
                element={
                  <div data-testid="requests-route">Requests page (sentinel)</div>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const VALID_ADDRESS = '0x' + 'a'.repeat(40)
const VALID_TX = '0x' + 'b'.repeat(64)

// USDX-40: burn form now uses UserNameTypeahead → GET /api/v1/users
// (mirrors mint form). MSW seeds users from customerStore via
// customerToPhaseOneUser, so "Julian Anderson" still resolves.
async function pickFirstUser(user: ReturnType<typeof userEvent.setup>) {
  const search = screen.getByPlaceholderText(/search by name/i)
  await user.type(search, 'Julian')
  const result = await screen.findByText(/Julian Anderson/i)
  await user.click(result)
}

async function fillRequiredNonUserName(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/user wallet address/i), VALID_ADDRESS)
  await user.type(screen.getByLabelText(/^amount$/i), '500.00')
  // Chain is preset to polygon (single-option Phase 1 scope), no click needed.
  await user.type(screen.getByLabelText(/deposit tx hash/i), VALID_TX)
  await user.type(screen.getByLabelText(/bank name/i), 'BCA')
  await user.type(screen.getByLabelText(/bank account/i), '1234567890')
}

describe('BurnRequestPage @ USDX-12 acceptance', () => {
  // ─── AC1: Open /burn → form appears with all fields ───
  describe('AC1 — open /burn shows the full form', () => {
    test('should render every field listed in sot/openapi.yaml § CreateBurnRequest', () => {
      renderBurnRoute()

      expect(
        screen.getByRole('heading', { name: /burn.*redeem.*usdx/i })
      ).toBeInTheDocument()

      // USDX-40: userName surface = UserNameTypeahead → /api/v1/users (per
      // sot/openapi.yaml § /api/v1/users + phase-1.md L271 users table).
      expect(screen.getByText(/^user name$/i)).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText(/search by name/i)
      ).toBeInTheDocument()

      expect(screen.getByLabelText(/user wallet address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^amount$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^chain$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/deposit tx hash/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/bank account/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()

      expect(
        screen.getByRole('button', { name: /submit burn request/i })
      ).toBeInTheDocument()
    })

    test('should show only polygon as the chain option (Phase 1 scope)', async () => {
      const user = userEvent.setup()
      renderBurnRoute()
      // Chain is preset; opening the dropdown should expose exactly one option.
      await user.click(screen.getByLabelText(/^chain$/i))
      const options = await screen.findAllByRole('option')
      expect(options).toHaveLength(1)
      expect(options[0]).toHaveTextContent(/polygon/i)
    })
  })

  // ─── USDX-40 AC #4: typeahead direct coverage (mirror of mint AC2) ───
  // Burn previously exercised typeahead implicitly via pickFirstUser flow
  // tests. Mint AC2 has dedicated typeahead tests; for parity we add the
  // same shape here so AC #4 has direct evidence on both forms.
  describe('USDX-40 AC #4 — userName typeahead direct coverage', () => {
    test('should fetch and show matches when typing in user name', async () => {
      const user = userEvent.setup()
      // Deterministic seed so the listbox content does not depend on
      // customerStore ordering.
      server.use(
        http.get('/api/v1/users', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 8, total: 1 },
            data: [
              {
                id: 'usr_typeahead',
                name: 'Bruce Wayne',
                notes: null,
                wallets: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          })
        )
      )
      renderBurnRoute()
      await user.type(screen.getByPlaceholderText(/search by name/i), 'Bruce')
      const listbox = await screen.findByRole(
        'listbox',
        { name: /matching users/i },
        { timeout: 3000 }
      )
      const options = await within(listbox).findAllByRole('option')
      expect(options.length).toBeGreaterThan(0)
      expect(
        options.some((o) => /bruce/i.test(o.textContent ?? ''))
      ).toBe(true)
    })

    test('should hit GET /api/v1/users with the typed search param', async () => {
      const user = userEvent.setup()
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
      renderBurnRoute()
      await user.type(screen.getByPlaceholderText(/search by name/i), 'Bruce')
      await waitFor(
        () => {
          expect(calls.some((url) => url.includes('search=Bruce'))).toBe(true)
        },
        { timeout: 3000 }
      )
    })

    test('should fill userName but leave userAddress untouched on selection', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/users', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 8, total: 1 },
            data: [
              {
                id: 'usr_typeahead',
                name: 'Bruce Wayne',
                notes: null,
                wallets: [
                  {
                    id: 'wlt_1',
                    chain: 'polygon',
                    address: VALID_ADDRESS,
                    createdAt: new Date().toISOString(),
                  },
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          })
        )
      )
      renderBurnRoute()
      await user.type(screen.getByPlaceholderText(/search by name/i), 'Bruce')
      const listbox = await screen.findByRole(
        'listbox',
        { name: /matching users/i },
        { timeout: 3000 }
      )
      const options = await within(listbox).findAllByRole('option')
      const target = options.find((o) => /bruce/i.test(o.textContent ?? ''))
      expect(target).toBeDefined()
      await user.click(within(target!).getByRole('button'))

      const nameInput = screen.getByPlaceholderText(
        /search by name/i
      ) as HTMLInputElement
      const addressInput = screen.getByLabelText(
        /user wallet address/i
      ) as HTMLInputElement
      await waitFor(() => {
        expect(nameInput.value).toMatch(/bruce/i)
      })
      // Per BurnRequestForm policy (mirror of mint): selection sets name only;
      // operator must enter the wallet address explicitly even if the user
      // record has wallets attached.
      expect(addressInput.value).toBe('')
    })
  })

  // ─── AC2: depositTxHash validation: must be 0x + 64 hex chars ───
  describe('AC2 — depositTxHash 0x+64 hex validation', () => {
    test('should show an inline error when the hash is shorter than 64 hex chars', async () => {
      const user = userEvent.setup()
      renderBurnRoute()

      await pickFirstUser(user)
      await fillRequiredNonUserName(user)
      const txInput = screen.getByLabelText(/deposit tx hash/i)
      await user.clear(txInput)
      await user.type(txInput, '0x' + 'a'.repeat(63))

      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid tx hash/i)).toBeInTheDocument()
      })
      expect(screen.queryByTestId('requests-route')).toBeNull()
    })

    test('should show an inline error when the hash is missing the 0x prefix', async () => {
      const user = userEvent.setup()
      renderBurnRoute()

      await pickFirstUser(user)
      await fillRequiredNonUserName(user)
      const txInput = screen.getByLabelText(/deposit tx hash/i)
      await user.clear(txInput)
      await user.type(txInput, 'a'.repeat(64))

      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid tx hash/i)).toBeInTheDocument()
      })
    })
  })

  // ─── AC3: Submit valid → redirect to /requests ───
  describe('AC3 — valid submit redirects to /requests', () => {
    test('should POST to /api/v1/burn and navigate to /requests on success', async () => {
      const user = userEvent.setup()
      renderBurnRoute()

      await pickFirstUser(user)
      await fillRequiredNonUserName(user)
      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(screen.getByTestId('requests-route')).toBeInTheDocument()
      })
    })

    test('should send a request body matching sot/openapi.yaml § CreateBurnRequest exactly', async () => {
      let capturedBody: Record<string, unknown> | null = null
      server.use(
        http.post('/api/v1/burn', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            {
              status: 'success',
              metadata: null,
              data: { id: 'captured', status: 'PENDING_APPROVAL' },
            },
            { status: 201 }
          )
        })
      )

      const user = userEvent.setup()
      renderBurnRoute()

      await pickFirstUser(user)
      await fillRequiredNonUserName(user)
      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(screen.getByTestId('requests-route')).toBeInTheDocument()
      })

      // SoT CreateBurnRequest required fields (sot/openapi.yaml L835).
      // `amount` is a string per SoT; with `type="text" inputMode="decimal"`
      // the user input survives 1:1, so "500.00" reaches the body verbatim.
      // userAddress is normalized to canonical EIP-55 form before submit
      // (sot/conventions.md L114), mirroring MintRequestPage.
      expect(capturedBody).toMatchObject({
        userName: expect.stringMatching(/Julian Anderson/i),
        userAddress: getAddress(VALID_ADDRESS),
        amount: '500.00',
        chain: 'polygon',
        depositTxHash: VALID_TX,
        bankName: 'BCA',
        bankAccount: '1234567890',
      })
      // Body must not include client-only fields.
      expect(capturedBody).not.toHaveProperty('customer')
    })
  })

  // ─── AC4: API returns error → error message displayed ───
  describe('AC4 — backend error surfaces in the form', () => {
    test('should display the backend error message and stay on /burn', async () => {
      // Override the burn handler to simulate a backend rejection
      // (e.g. on-chain verification failure, amount mismatch — sot/phase-1.md
      // L236). The form must surface the message and stay put.
      server.use(
        http.post('/api/v1/burn', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Deposit TX could not be verified on-chain',
              },
            },
            { status: 400 }
          )
        )
      )

      const user = userEvent.setup()
      renderBurnRoute()

      await pickFirstUser(user)
      await fillRequiredNonUserName(user)
      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/deposit tx could not be verified on-chain/i)
        ).toBeInTheDocument()
      })
      // Did NOT navigate; values preserved.
      expect(screen.queryByTestId('requests-route')).toBeNull()
      expect(screen.getByLabelText(/user wallet address/i)).toHaveValue(
        VALID_ADDRESS
      )
    })

    // USDX-40 AC #5 literal "Amount validation → API rejects invalid
    // amounts" — covers the API path on burn (mint AC7 already covers
    // this via amount-cap example). Without it, burn only proves the
    // client-side gate (validators.test.ts) for amount.
    //
    // Bypasses pickFirstUser (typeahead-suggestion flow) by typing the
    // userName directly — BurnRequestForm accepts free-text userName
    // (post-d881aa0); the typeahead is just a helper. This keeps the test
    // deterministic and unaffected by /api/v1/users mock seeding flakiness.
    test(
      'should display the API error message when BE rejects a valid-format amount',
      async () => {
        server.use(
          http.post('/api/v1/burn', () =>
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

        // delay:0 → skip per-keystroke pacing so the long form fill stays
        // well under the 10s timeout when jsdom is loaded by the full suite.
        const user = userEvent.setup({ delay: 0 })
        renderBurnRoute()

        await user.type(screen.getByPlaceholderText(/search by name/i), 'Bruce Wayne')
        await fillRequiredNonUserName(user)
        await user.click(screen.getByRole('button', { name: /submit burn request/i }))

        expect(
          await screen.findByText(/amount exceeds the daily backend cap/i, {}, { timeout: 5000 })
        ).toBeInTheDocument()
        expect(screen.queryByTestId('requests-route')).toBeNull()
      },
      15000
    )

    // USDX-40 AC #3 literal "Invalid address → error message dari API" —
    // mirror of mint's BE-rejects-address test. Burn's existing AC4 test
    // covers the deposit-TX rejection path; this adds the address rejection
    // path so AC #3 is proven on both forms.
    //
    // Bypasses pickFirstUser (see AC #5 amount-rejection test above) by
    // typing userName directly so this test is independent of the typeahead
    // mock seeding flakiness.
    test(
      'should display the API error message when BE rejects a valid-format address',
      async () => {
        server.use(
          http.post('/api/v1/burn', () =>
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

        const user = userEvent.setup({ delay: 0 })
        renderBurnRoute()

        await user.type(screen.getByPlaceholderText(/search by name/i), 'Bruce Wayne')
        await fillRequiredNonUserName(user)
        await user.click(screen.getByRole('button', { name: /submit burn request/i }))

        expect(
          await screen.findByText(/user address is not a valid evm address/i, {}, { timeout: 5000 })
        ).toBeInTheDocument()
        expect(screen.queryByTestId('requests-route')).toBeNull()
      },
      15000
    )
  })
})
