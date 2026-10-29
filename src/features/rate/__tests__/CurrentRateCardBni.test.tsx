import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CurrentRateCard from '@/features/rate/CurrentRateCard'
import type { RateInfo } from '@/lib/types'

// USDX-778 — kartu "Kurs saat ini" untuk D28 (`sot/api/rate.yaml § RateInfo`,
// `bni-integration.md` §20.1/§20.4): dasar beli & jual terpisah, angka FX-Get
// Rate BNI mentah + jam ambil + X pada mode BNI, "—" (bukan 0/NaN) saat kurs
// BNI tidak tersedia.

const MANUAL: RateInfo = {
  baseRate: '16250.0000',
  baseSellRate: '16250.0000',
  mode: 'MANUAL',
  spreadBuyPct: '0.5000',
  spreadSellPct: '0.4000',
  effectiveBuyRate: '16331.2500',
  effectiveSellRate: '16185.0000',
  gatewayMarkupPct: '1.0000',
  gatewayBuyRate: '16412.5000',
  bniBuyRate: null,
  bniBuyRateUpdatedAt: null,
  bniTransferBuyRate: null,
  bniFxBuyRate: null,
  bniFxSellRate: null,
  bniFxFetchedAt: null,
  bniFxQuoteId: null,
  bniRateMaxDeviationPct: '3.0000',
  rateUnavailableReason: null,
  updatedAt: '2026-10-29T02:00:00.000Z',
}

// Contoh AC USDX-778: sellRate 18.140 → dasar beli, buyRate 17.773 → dasar jual.
const BNI: RateInfo = {
  ...MANUAL,
  mode: 'BNI',
  baseRate: '18140.0000',
  baseSellRate: '17773.0000',
  effectiveBuyRate: '18230.7000',
  effectiveSellRate: '17701.9080',
  gatewayBuyRate: '18321.4000',
  bniFxBuyRate: '17773.0000',
  bniFxSellRate: '18140.0000',
  bniFxFetchedAt: '2026-10-29T03:00:00.000Z',
  bniFxQuoteId: '0193a0b2-7c1d-7e2f-8a3b-4c5d6e7f8091',
}

const BNI_UNAVAILABLE: RateInfo = {
  ...BNI,
  baseRate: null,
  baseSellRate: null,
  effectiveBuyRate: null,
  effectiveSellRate: null,
  gatewayBuyRate: null,
  bniFxBuyRate: null,
  bniFxSellRate: null,
  bniFxFetchedAt: null,
  bniFxQuoteId: null,
  rateUnavailableReason: 'BNI_UNREACHABLE',
}

describe('CurrentRateCard (D28)', () => {
  describe('positive', () => {
    test('mode BNI shows source, buy/sell bases separately, raw BNI numbers, fetch time (WIB) and X', () => {
      render(<CurrentRateCard data={BNI} isLoading={false} />)
      expect(screen.getByText('Kurs BNI (FX-Get Rate)', { selector: 'dd' })).toBeInTheDocument()
      expect(screen.getByLabelText('kurs dasar beli')).toHaveTextContent('18.140,00 IDR/USD')
      expect(screen.getByLabelText('kurs dasar jual')).toHaveTextContent('17.773,00 IDR/USD')
      expect(screen.getByLabelText('kurs jual BNI')).toHaveTextContent('18.140,00 IDR/USD')
      expect(screen.getByLabelText('kurs beli BNI')).toHaveTextContent('17.773,00 IDR/USD')
      // 03:00 UTC = 10:00 WIB
      expect(screen.getByLabelText('jam ambil kurs BNI')).toHaveTextContent('29 Okt 2026, 10:00:00')
      expect(screen.getByLabelText('batas pergeseran kurs BNI')).toHaveTextContent('3%')
    })
  })

  describe('negative', () => {
    test('MANUAL/DYNAMIC: one base for both directions and no BNI block', () => {
      const { rerender } = render(<CurrentRateCard data={MANUAL} isLoading={false} />)
      expect(screen.getByLabelText('kurs dasar beli')).toHaveTextContent('16.250,00 IDR/USD')
      expect(screen.getByLabelText('kurs dasar jual')).toHaveTextContent('16.250,00 IDR/USD')
      expect(screen.queryByLabelText('kurs jual BNI')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('batas pergeseran kurs BNI')).not.toBeInTheDocument()

      rerender(<CurrentRateCard data={{ ...MANUAL, mode: 'DYNAMIC' }} isLoading={false} />)
      expect(screen.getByText('Otomatis (kurs pasar)')).toBeInTheDocument()
      expect(screen.queryByLabelText('kurs beli BNI')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('BNI rate unavailable: every rate field reads "—", never 0 or NaN', () => {
      const { container } = render(<CurrentRateCard data={BNI_UNAVAILABLE} isLoading={false} />)
      for (const label of [
        'kurs dasar beli',
        'kurs dasar jual',
        'kurs beli berlaku',
        'kurs jual berlaku',
        'kurs beli virtual account',
        'kurs jual BNI',
        'kurs beli BNI',
        'jam ambil kurs BNI',
      ]) {
        expect(screen.getByLabelText(label)).toHaveTextContent(/^—$/)
      }
      // X is a setting, not a rate — still shown.
      expect(screen.getByLabelText('batas pergeseran kurs BNI')).toHaveTextContent('3%')
      expect(container).not.toHaveTextContent(/NaN/)
    })
    test('a server without USDX-777 (no baseSellRate) shows "—" for the sell base', () => {
      const legacy: RateInfo = { ...MANUAL }
      delete legacy.baseSellRate
      render(<CurrentRateCard data={legacy} isLoading={false} />)
      expect(screen.getByLabelText('kurs dasar jual')).toHaveTextContent(/^—$/)
    })
  })
})
