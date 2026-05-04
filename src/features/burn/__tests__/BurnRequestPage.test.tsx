import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData, getDefaultStaff } from '@/mocks/handlers'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import BurnRequestPage from '@/features/burn/BurnRequestPage'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// Renders /burn inside a router that also recognises /requests so we can
// assert post-submit navigation (AC3) without leaving the test harness.
function renderBurnRoute(initialPath = '/burn') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  const staff = getDefaultStaff()
  if (staff) {
    localStorage.setItem(
      'usdx_auth_user',
      JSON.stringify({
        version: 3,
        staffId: staff.id,
        token: 'test-bypass',
        issuedAt: Date.now(),
      })
    )
  }

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

async function fillAllRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/user name/i), 'Alice Tester')
  await user.type(screen.getByLabelText(/user wallet address/i), VALID_ADDRESS)
  await user.type(screen.getByLabelText(/^amount$/i), '500.00')

  // Radix Select — open the trigger then click the option
  await user.click(screen.getByLabelText(/^chain$/i))
  await user.click(await screen.findByRole('option', { name: /polygon/i }))

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

      expect(screen.getByLabelText(/user name/i)).toBeInTheDocument()
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
  })

  // ─── AC2: depositTxHash validation: must be 0x + 64 hex chars ───
  describe('AC2 — depositTxHash 0x+64 hex validation', () => {
    test('should show an inline error when the hash is shorter than 64 hex chars', async () => {
      const user = userEvent.setup()
      renderBurnRoute()

      await fillAllRequiredFields(user)
      // Replace the valid hash with an invalid one (too short)
      const txInput = screen.getByLabelText(/deposit tx hash/i)
      await user.clear(txInput)
      await user.type(txInput, '0x' + 'a'.repeat(63))

      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid tx hash/i)).toBeInTheDocument()
      })
      // Confirms the form was NOT submitted (sentinel never appeared)
      expect(screen.queryByTestId('requests-route')).toBeNull()
    })

    test('should show an inline error when the hash is missing the 0x prefix', async () => {
      const user = userEvent.setup()
      renderBurnRoute()

      await fillAllRequiredFields(user)
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

      await fillAllRequiredFields(user)
      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(screen.getByTestId('requests-route')).toBeInTheDocument()
      })
    })
  })

  // ─── AC4: API returns error → error message displayed ───
  describe('AC4 — backend error surfaces in the form', () => {
    test('should display the backend error message and stay on /burn', async () => {
      // Override the burn handler to simulate a backend rejection
      // (e.g. on-chain verification failure, amount mismatch).
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

      await fillAllRequiredFields(user)
      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/deposit tx could not be verified on-chain/i)
        ).toBeInTheDocument()
      })
      // Did NOT navigate
      expect(screen.queryByTestId('requests-route')).toBeNull()
      // Form values preserved
      expect(screen.getByLabelText(/user wallet address/i)).toHaveValue(
        VALID_ADDRESS
      )
    })

    test('should also surface the error from the built-in mock failure sentinel txHash', async () => {
      const user = userEvent.setup()
      renderBurnRoute()

      await fillAllRequiredFields(user)
      const txInput = screen.getByLabelText(/deposit tx hash/i)
      await user.clear(txInput)
      // 0xdead repeated 16x = 64 hex chars; matches src/mocks/handlers.ts sentinel
      await user.type(txInput, '0x' + 'dead'.repeat(16))

      await user.click(screen.getByRole('button', { name: /submit burn request/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/deposit tx could not be verified on-chain or amount mismatch/i)
        ).toBeInTheDocument()
      })
      expect(screen.queryByTestId('requests-route')).toBeNull()
    })
  })
})
