import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { createMockHeldCredits, HELD_CREDIT_MOCK_IDS } from '@/mocks/data'
import HeldCreditsPage from '@/features/held-credits/HeldCreditsPage'
import HeldCreditDetailModal from '@/features/held-credits/HeldCreditDetailModal'
import {
  amountGapLabel,
  expectedAmountLabel,
  receivedAmountLabel,
} from '@/features/held-credits/labels'
import { willNeedSecondPerson } from '@/features/held-credits/makerChecker'
import type { HeldCreditDetail } from '@/features/held-credits/types'
import { renderWithProviders } from '@/test/test-utils'

// Transfer BNI dalam USD (USDX-749, keputusan PM 14 Okt 2026): kredit ke rekening
// penampung USD membawa `receivedAmount` + `amountCurrency: "USD"` (dan
// `receivedAmountIdr: null`); order-nya `expectedAmount` + `expectedAmountCurrency`.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

/** Kredit USD $3,47 untuk order bertagihan $3,47 (padanan Rp 55.520), kurs order 16.000. */
function usdCredit(over: Partial<HeldCreditDetail> = {}): HeldCreditDetail {
  const base = createMockHeldCredits().get(HELD_CREDIT_MOCK_IDS.latePayment)!
  return {
    ...base,
    receivedAmountIdr: null,
    receivedAmount: '3.47',
    amountCurrency: 'USD',
    receivedAmountRaw: '3.47',
    order: {
      ...base.order!,
      amount: '3.470000',
      expectedAmountIdr: '55520.00',
      expectedAmount: '3.47',
      expectedAmountCurrency: 'USD',
      effectiveRate: '16000.0000',
      uniqueCode: '47',
    },
    ...over,
  }
}

// Satu kredit untuk list dan detail. Field khusus detail ikut terkirim di list —
// layar list tidak membacanya, jadi tidak mengubah apa yang diuji.
function serveCredit(credit: HeldCreditDetail) {
  server.use(
    http.get('/api/v1/held-credits', () =>
      HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 10, total: 1 }, data: [credit] }),
    ),
    http.get('/api/v1/held-credits/:id', () => HttpResponse.json({ status: 'success', metadata: null, data: credit })),
  )
}

describe('held credits — nominal dalam mata uangnya (USDX-749)', () => {
  describe('positive', () => {
    test('a USD credit reads "$3,47" and its order "ditagihkan $3,47"', () => {
      const c = usdCredit()
      expect(receivedAmountLabel(c)).toBe('$3,47')
      expect(expectedAmountLabel(c.order)).toBe('$3,47')
      expect(amountGapLabel(c)).toBeNull()
    })

    test('the gap between two USD amounts is in dollars', () => {
      expect(amountGapLabel(usdCredit({ receivedAmount: '3.00' }))).toBe('kurang $0,47')
      expect(amountGapLabel(usdCredit({ receivedAmount: '4.00' }))).toBe('lebih $0,53')
    })

    test('the list shows the USD credit and the USD bill, never the rupiah equivalent as the bill', async () => {
      serveCredit(usdCredit({ receivedAmount: '3.00', receivedAmountRaw: '3.00' }))
      const { container } = renderWithProviders(<HeldCreditsPage />, { initialEntries: ['/mint-bermasalah'], staffId: 'stf_2' })
      expect(await screen.findByText('$3,00')).toBeInTheDocument()
      const row = container.querySelector<HTMLElement>('tbody tr')!
      expect(within(row).getByText('ditagihkan $3,47')).toBeInTheDocument()
      expect(within(row).getByText('kurang $0,47')).toBeInTheDocument()
      expect(within(row).queryByText(/Rp 55\.520/)).not.toBeInTheDocument()
    })

    test('the detail names the bill in USD with its rupiah equivalent beside it', async () => {
      serveCredit(usdCredit())
      renderWithProviders(<HeldCreditDetailModal creditId={HELD_CREDIT_MOCK_IDS.latePayment} open onOpenChange={() => {}} />, {
        initialEntries: ['/mint-bermasalah'],
        staffId: 'stf_2',
      })
      expect(await screen.findByText('padanan Rp 55.520,00')).toBeInTheDocument()
      expect(screen.getAllByText('$3,47').length).toBeGreaterThanOrEqual(2) // masuk + ditagihkan
    })
  })

  describe('negative', () => {
    test('a USD credit against a rupiah bill gets no gap (no rate, no meaningful difference)', () => {
      const c = usdCredit()
      const cross = { ...c, order: { ...c.order!, expectedAmount: '55520.00', expectedAmountCurrency: 'IDR' as const } }
      expect(amountGapLabel(cross)).toBeNull()
      expect(expectedAmountLabel(cross.order)).toBe('Rp 55.520,00')
    })

    test('a USD credit with no order rate fails closed: it needs a second person', () => {
      const c = usdCredit()
      expect(willNeedSecondPerson({ ...c, order: { ...c.order!, effectiveRate: null } }, null)).toBe(true)
      expect(willNeedSecondPerson({ ...c, order: null }, null)).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('an unreadable USD amount is shown raw, not rounded and not "Rp"', () => {
      expect(receivedAmountLabel(usdCredit({ receivedAmount: null, receivedAmountRaw: '3.475' }))).toBe(
        '$3.475 (bukan sen bulat)',
      )
    })

    test('an older backend without the currency fields stays rupiah', () => {
      const base = createMockHeldCredits().get(HELD_CREDIT_MOCK_IDS.latePayment)!
      expect(receivedAmountLabel(base)).toBe('Rp 1.640.407,00')
      expect(expectedAmountLabel(base.order)).toBe('Rp 1.640.407,00')
    })

    test('a small USD credit valued at the order rate stays under the threshold', () => {
      // $3,47 × 16.000 = Rp 55.520 < Rp 10 jt
      expect(willNeedSecondPerson(usdCredit(), null)).toBe(false)
    })

    test('a large USD credit valued at the order rate goes above the threshold', () => {
      // $700,00 × 16.000 = Rp 11,2 jt > Rp 10 jt
      const c = usdCredit({ receivedAmount: '700.00' })
      expect(willNeedSecondPerson({ ...c, order: { ...c.order!, expectedAmountIdr: '1000.00' } }, null)).toBe(true)
    })
  })
})
