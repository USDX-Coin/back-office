import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { configureBniFxForTests, resetMockData } from '@/mocks/handlers'
import RatePage from '@/features/rate/RatePage'
import RateUnavailableBanner from '@/features/rate/RateUnavailableBanner'
import { renderWithProviders } from '@/test/test-utils'
import type { RateInfo, RateUnavailableReason } from '@/lib/types'

// USDX-778 — banner "kurs tidak tersedia" per `rateUnavailableReason` (D28,
// `bni-integration.md` §20.4) + langkah pemulihan Q1 §20.8 untuk BNI_DEVIATION.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function unavailable(reason: RateUnavailableReason | null): RateInfo {
  return {
    mode: 'BNI',
    baseRate: null,
    baseSellRate: null,
    spreadBuyPct: '0.5000',
    spreadSellPct: '0.4000',
    effectiveBuyRate: null,
    effectiveSellRate: null,
    gatewayMarkupPct: '1.0000',
    gatewayBuyRate: null,
    bniFxBuyRate: null,
    bniFxSellRate: null,
    bniFxFetchedAt: null,
    bniFxQuoteId: null,
    bniRateMaxDeviationPct: '3.0000',
    rateUnavailableReason: reason,
    updatedAt: '2026-10-29T02:00:00.000Z',
  }
}

describe('RateUnavailableBanner', () => {
  describe('positive', () => {
    test('BNI_UNREACHABLE: says the rate cannot be fetched and mint/redeem are rejected', () => {
      render(<RateUnavailableBanner data={unavailable('BNI_UNREACHABLE')} />)
      const banner = screen.getByRole('alert')
      expect(banner).toHaveTextContent('Kurs BNI tidak bisa diambil — mint/redeem sedang ditolak')
      expect(banner).toHaveTextContent(/pindahkan mode ke Manual/)
    })
    test('BNI_DEVIATION: names the guard, the active X, and the Q1 recovery steps in order', () => {
      render(<RateUnavailableBanner data={unavailable('BNI_DEVIATION')} />)
      const banner = screen.getByRole('alert')
      expect(banner).toHaveTextContent('Kurs BNI ditolak pengaman pergeseran')
      expect(banner).toHaveTextContent('X = 3%')
      const steps = within(banner).getAllByRole('listitem').map((li) => li.textContent)
      expect(steps).toHaveLength(4)
      expect(steps[0]).toMatch(/wondr atau portal BNI/)
      expect(steps[1]).toMatch(/naikkan batas pergeseran \(X\) sementara/)
      expect(steps[3]).toMatch(/Kembalikan X/)
      expect(banner).toHaveTextContent(/pindahkan mode ke Manual/)
    })
    test('BNI_MALFORMED: says the bank numbers failed the shape check', () => {
      render(<RateUnavailableBanner data={unavailable('BNI_MALFORMED')} />)
      expect(screen.getByRole('alert')).toHaveTextContent('Kurs BNI tidak wajar — mint/redeem sedang ditolak')
    })
  })

  describe('negative', () => {
    test('renders nothing when the rate is available', () => {
      const { container } = render(<RateUnavailableBanner data={unavailable(null)} />)
      expect(container).toBeEmptyDOMElement()
    })
    test('renders nothing for a server that does not send the field (before USDX-777)', () => {
      const legacy = unavailable(null)
      delete legacy.rateUnavailableReason
      const { container } = render(<RateUnavailableBanner data={legacy} />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('edge cases', () => {
    test('an unknown future reason still warns, showing the raw code', () => {
      const data = { ...unavailable(null), rateUnavailableReason: 'BNI_NEW' as RateUnavailableReason }
      render(<RateUnavailableBanner data={data} />)
      const banner = screen.getByRole('alert')
      expect(banner).toHaveTextContent('Kurs BNI tidak tersedia — mint/redeem sedang ditolak')
      expect(banner).toHaveTextContent('BNI_NEW')
    })
  })
})

describe('RatePage with the BNI rate unavailable @integration', () => {
  describe('positive', () => {
    test('page stays open: banner + "—" rates, settings still readable, edit button still there', async () => {
      server.use(
        http.get('/api/v1/rate', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: unavailable('BNI_UNREACHABLE') }),
        ),
      )
      renderWithProviders(<RatePage />, { authenticated: true })
      expect(await screen.findByRole('alert')).toHaveTextContent('Kurs BNI tidak bisa diambil')
      expect(screen.getByLabelText('kurs dasar beli')).toHaveTextContent(/^—$/)
      expect(screen.getByText('0,5%')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^ubah kurs$/i })).toBeEnabled()
    })
  })

  describe('negative', () => {
    test('no banner on the seeded DYNAMIC config', async () => {
      renderWithProviders(<RatePage />, { authenticated: true })
      expect(await screen.findByLabelText('kurs dasar beli')).toHaveTextContent(/IDR\/USD/)
      expect(screen.queryByTestId('rate-unavailable-banner')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('BNI unavailable while the active mode is not BNI: no banner (contract only sets it on BNI)', async () => {
      configureBniFxForTests({ status: 'UNAVAILABLE', reason: 'BNI_UNREACHABLE' })
      renderWithProviders(<RatePage />, { authenticated: true })
      expect(await screen.findByLabelText('kurs dasar beli')).toHaveTextContent(/IDR\/USD/)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
