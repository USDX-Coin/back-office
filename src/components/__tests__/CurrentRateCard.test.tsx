import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import CurrentRateCard from '@/components/CurrentRateCard'
import { renderWithProviders } from '@/test/test-utils'

// USDX-40 AC #6: rate displayed must match `GET /api/v1/rate`. The card is
// rendered inside Mint and Burn pages but is the sole component that owns
// the AC, so it gets dedicated coverage here.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function setup() {
  return renderWithProviders(<CurrentRateCard />, { authenticated: true })
}

describe('CurrentRateCard', () => {
  describe('loading state', () => {
    test('should render the skeleton placeholder while the rate query is in flight', async () => {
      // Hold the response so the loading state is observable.
      server.use(
        http.get('/api/v1/rate', async () => {
          await new Promise((r) => setTimeout(r, 100))
          return HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              rate: '16250.00',
              mode: 'MANUAL',
              spreadPct: '0.5',
              updatedAt: new Date().toISOString(),
            },
          })
        })
      )

      const { container } = setup()
      // shadcn/ui Skeleton renders a div with `animate-pulse` (see
      // src/components/ui/skeleton.tsx); presence before the rate value
      // resolves is the loading signal.
      expect(container.querySelector('.animate-pulse')).not.toBeNull()
      expect(screen.queryByTestId('rate-display')).toBeNull()

      // After the handler resolves, the skeleton is replaced by the value.
      await waitFor(() => {
        expect(screen.getByTestId('rate-display')).toBeInTheDocument()
      })
    })
  })

  describe('error state', () => {
    test('should render the "Could not load rate" fallback when the API errors', async () => {
      server.use(
        http.get('/api/v1/rate', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL_ERROR', message: 'rate provider down' },
            },
            { status: 500 }
          )
        )
      )

      setup()
      expect(
        await screen.findByText(/could not load rate/i)
      ).toBeInTheDocument()
      // Value display must NOT appear on error.
      expect(screen.queryByTestId('rate-display')).toBeNull()
    })
  })

  describe('success state', () => {
    test('should render the rate value, MANUAL mode label, and spread %', async () => {
      server.use(
        http.get('/api/v1/rate', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              rate: '16250.00',
              mode: 'MANUAL',
              spreadPct: '0.5',
              updatedAt: new Date().toISOString(),
            },
          })
        )
      )

      setup()
      const display = await screen.findByTestId('rate-display')
      // formatIdr uses Intl.NumberFormat('id-ID') — we check the integer
      // digits survive the locale formatting (separator may vary across
      // ICU versions, e.g. "16.250" vs "16,250"). The literal "Rp" prefix
      // is required.
      expect(display.textContent ?? '').toMatch(/^Rp\s/)
      expect((display.textContent ?? '').replace(/\D/g, '')).toContain('16250')

      expect(await screen.findByText(/manual rate/i)).toBeInTheDocument()
      expect(screen.getByText(/spread\s*0\.5%/i)).toBeInTheDocument()
    })

    test('should render "Dynamic rate" label when mode is DYNAMIC', async () => {
      server.use(
        http.get('/api/v1/rate', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              rate: '16500.00',
              mode: 'DYNAMIC',
              spreadPct: '1',
              updatedAt: new Date().toISOString(),
            },
          })
        )
      )

      setup()
      expect(await screen.findByText(/dynamic rate/i)).toBeInTheDocument()
      // Sanity-check the value too so we don't accidentally accept stale
      // MANUAL fixture leaking from a prior test.
      const display = await screen.findByTestId('rate-display')
      expect((display.textContent ?? '').replace(/\D/g, '')).toContain('16500')
    })
  })
})
