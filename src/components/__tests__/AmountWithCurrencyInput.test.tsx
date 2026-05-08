import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { useState } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import AmountWithCurrencyInput from '@/components/AmountWithCurrencyInput'
import { renderWithProviders } from '@/test/test-utils'
import type { AmountCurrency } from '@/lib/types'

// USDX-51 scope mentions: "Saat pilih currency: input amount dalam USD atau IDR,
// auto-hitung yang lain dari rate." There is no AC pass/fail criterion for this
// in Linear — these tests lock in the behavior already shipped via USDX-46 so a
// silent regression is caught.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const RATE = '16250.00'

function rateOk() {
  return http.get('/api/v1/rate', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: { rate: RATE, mode: 'MANUAL', spreadPct: '0', updatedAt: '2026-05-01T00:00:00Z' },
    })
  )
}

function Harness({ initialCurrency = 'USD' as AmountCurrency }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<AmountCurrency>(initialCurrency)
  // The component doesn't render its own "Amount" label — consumers (Mint/Burn
  // forms) wrap it with a <Label htmlFor>. Mirror that wiring so the test can
  // address the input by accessible name.
  return (
    <div>
      <label htmlFor="amt">Amount</label>
      <AmountWithCurrencyInput
        amountId="amt"
        currencyId="ccy"
        amount={amount}
        currency={currency}
        onAmountChange={setAmount}
        onCurrencyChange={setCurrency}
      />
    </div>
  )
}

function setup(props: { initialCurrency?: AmountCurrency } = {}) {
  return renderWithProviders(<Harness {...props} />, { authenticated: true })
}

describe('AmountWithCurrencyInput auto-convert @ USDX-51 scope', () => {
  describe('USD input → IDR preview', () => {
    test('100 USD with rate 16250 shows ≈ Rp 1.625.000', async () => {
      const user = userEvent.setup()
      server.use(rateOk())
      setup({ initialCurrency: 'USD' })

      // Wait for rate to load before typing — preview otherwise reads "Loading rate…".
      await waitFor(() => {
        expect(screen.getByTestId('amount-conversion-preview').textContent).not.toMatch(
          /loading/i
        )
      })

      await user.type(screen.getByLabelText(/^amount$/i), '100')
      const preview = screen.getByTestId('amount-conversion-preview')
      // Locale separators vary; assert the digit run survives formatting.
      await waitFor(() =>
        expect((preview.textContent ?? '').replace(/\D/g, '')).toContain('1625000')
      )
      expect(preview.textContent ?? '').toMatch(/^≈ Rp\s/)
    })
  })

  describe('IDR input → USDX preview', () => {
    test('1.625.000 IDR with rate 16250 shows ≈ 100 USDX', async () => {
      const user = userEvent.setup()
      server.use(rateOk())
      setup({ initialCurrency: 'IDR' })

      await waitFor(() => {
        expect(screen.getByTestId('amount-conversion-preview').textContent).not.toMatch(
          /loading/i
        )
      })

      await user.type(screen.getByLabelText(/^amount$/i), '1625000')
      const preview = screen.getByTestId('amount-conversion-preview')
      await waitFor(() => {
        const text = preview.textContent ?? ''
        expect(text).toMatch(/^≈\s/)
        expect(text).toMatch(/USDX/i)
        // 1_625_000 / 16_250 = 100. formatUsdxAmount may render "100.00" or
        // "100"; assert the integer segment.
        expect(text).toMatch(/\b100(\.\d+)?\s*USDX/i)
      })
    })
  })

  describe('edge cases', () => {
    test('empty amount renders the em-dash placeholder, not Loading/Rp', async () => {
      server.use(rateOk())
      setup()
      // Even before any rate fetch is awaited, the empty input means
      // hasValidAmount = false. After rate resolves, the preview should
      // settle to "—" since amount is still empty.
      await waitFor(() => {
        expect(screen.getByTestId('amount-conversion-preview').textContent).toBe('—')
      })
    })

    test('rate fetch failure shows the BE-will-compute fallback', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/rate', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL_ERROR', message: 'down' },
            },
            { status: 500 }
          )
        )
      )
      setup()
      await user.type(screen.getByLabelText(/^amount$/i), '100')
      const preview = await screen.findByTestId('amount-conversion-preview')
      await waitFor(() =>
        expect(preview.textContent ?? '').toMatch(/rate unavailable/i)
      )
    })
  })
})
