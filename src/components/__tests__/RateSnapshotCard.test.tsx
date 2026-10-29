import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import RateSnapshotCard from '@/components/RateSnapshotCard'
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
  return renderWithProviders(<RateSnapshotCard />, { authenticated: true })
}

describe('RateSnapshotCard', () => {
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
              baseRate: '16168.00',
              mode: 'MANUAL',
              spreadBuyPct: '0.5',
              spreadSellPct: '0.4',
              effectiveBuyRate: '16250.00',
              effectiveSellRate: '16103.00',
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
    test('should render the "Kurs gagal dimuat" fallback when the API errors', async () => {
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
        await screen.findByText(/kurs gagal dimuat/i)
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
              baseRate: '16168.00',
              mode: 'MANUAL',
              spreadBuyPct: '0.5',
              spreadSellPct: '0.4',
              effectiveBuyRate: '16250.00',
              effectiveSellRate: '16103.00',
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

      expect(await screen.findByText(/kurs manual/i)).toBeInTheDocument()
      expect(screen.getByText(/spread\s*beli\s*0\.5%/i)).toBeInTheDocument()
    })

    test('should render "Kurs dinamis" label when mode is DYNAMIC', async () => {
      server.use(
        http.get('/api/v1/rate', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              baseRate: '16336.00',
              mode: 'DYNAMIC',
              spreadBuyPct: '1',
              spreadSellPct: '0.5',
              effectiveBuyRate: '16500.00',
              effectiveSellRate: '16254.00',
              updatedAt: new Date().toISOString(),
            },
          })
        )
      )

      setup()
      expect(await screen.findByText(/kurs dinamis/i)).toBeInTheDocument()
      // Sanity-check the value too so we don't accidentally accept stale
      // MANUAL fixture leaking from a prior test.
      const display = await screen.findByTestId('rate-display')
      expect((display.textContent ?? '').replace(/\D/g, '')).toContain('16500')
    })
  })
})

// USDX-778 — D28: OTC ikut mode kurs aktif; pada mode BNI kurs bisa `null`.
describe('RateSnapshotCard mode BNI (D28)', () => {
  function stubRate(data: Record<string, unknown>) {
    server.use(http.get('/api/v1/rate', () => HttpResponse.json({ status: 'success', metadata: null, data })))
  }
  const BNI = {
    mode: 'BNI',
    baseRate: '18140.0000',
    baseSellRate: '17773.0000',
    spreadBuyPct: '0.5',
    spreadSellPct: '0.4',
    effectiveBuyRate: '18230.7000',
    effectiveSellRate: '17701.9080',
    rateUnavailableReason: null,
    updatedAt: '2026-10-29T02:00:00.000Z',
  }

  describe('positive', () => {
    test('labels the source as Kurs BNI, not "Kurs dinamis"', async () => {
      stubRate(BNI)
      setup()
      expect(await screen.findByTestId('rate-display')).toHaveTextContent('Rp 18.230,7')
      expect(screen.getByText(/Kurs BNI · spread beli/)).toBeInTheDocument()
      expect(screen.queryByText(/Kurs dinamis/)).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('rate unavailable: says so instead of "Rp —" / "Rp NaN"', async () => {
      stubRate({
        ...BNI,
        baseRate: null,
        baseSellRate: null,
        effectiveBuyRate: null,
        effectiveSellRate: null,
        rateUnavailableReason: 'BNI_UNREACHABLE',
      })
      setup()
      expect(await screen.findByTestId('rate-unavailable')).toHaveTextContent('Kurs BNI tidak tersedia')
      expect(screen.queryByTestId('rate-display')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('burn (sell) side reads the sell rate', async () => {
      stubRate(BNI)
      renderWithProviders(<RateSnapshotCard direction="sell" />, { authenticated: true })
      expect(await screen.findByTestId('rate-display')).toHaveTextContent('Rp 17.701,91')
    })
  })
})
