import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import RateConfirmDialog, { type RateConfirmDialogProps } from '@/features/rate/RateConfirmDialog'
import type { RateInfo } from '@/lib/types'

// USDX-778 — dialog konfirmasi untuk D28: pindah KE mode BNI mengingatkan
// kalibrasi Y + spread beli + spread jual (D28-d, kurs BNI sudah memuat spread
// bank), mode dibaca sebagai kata, dan X ikut diff.

const CURRENT: RateInfo = {
  baseRate: '16250.0000',
  baseSellRate: '16250.0000',
  mode: 'MANUAL',
  spreadBuyPct: '0.5000',
  spreadSellPct: '0.4000',
  effectiveBuyRate: '16331.2500',
  effectiveSellRate: '16185.0000',
  gatewayMarkupPct: '1.0000',
  gatewayBuyRate: '16412.5000',
  bniRateMaxDeviationPct: '3.0000',
  rateUnavailableReason: null,
  updatedAt: '2026-10-29T02:00:00.000Z',
}

function renderDialog(current: RateInfo, next: Partial<RateConfirmDialogProps['next']>) {
  render(
    <RateConfirmDialog
      open
      onOpenChange={vi.fn()}
      current={current}
      next={{
        mode: 'BNI',
        manualRate: '',
        spreadBuyPct: '0.5',
        spreadSellPct: '0.4',
        gatewayMarkupPct: '1',
        bniRateMaxDeviationPct: '3',
        ...next,
      }}
      onConfirm={vi.fn()}
      isPending={false}
    />,
  )
  return screen.getByRole('dialog', { name: /ubah kurs yang berlaku\?/i })
}

describe('RateConfirmDialog (D28)', () => {
  describe('positive', () => {
    test('switching MANUAL → BNI reminds to calibrate Y, spread beli and spread jual', () => {
      const dialog = renderDialog(CURRENT, { mode: 'BNI' })
      const note = within(dialog).getByTestId('rate-bni-calibration-reminder')
      expect(note).toHaveTextContent(/Markup Virtual Account \(Y\), spread beli, dan spread\s+jual/)
      expect(note).toHaveTextContent(/kurs BNI sudah memuat spread bank/i)
      expect(within(dialog).getByText('Kurs BNI (FX-Get Rate)')).toBeInTheDocument()
      expect(within(dialog).getByText('otomatis (kurs BNI)')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('no reminder when the mode is already BNI (e.g. raising X during recovery)', () => {
      const dialog = renderDialog({ ...CURRENT, mode: 'BNI' }, { mode: 'BNI', bniRateMaxDeviationPct: '6' })
      expect(within(dialog).queryByTestId('rate-bni-calibration-reminder')).not.toBeInTheDocument()
      expect(within(dialog).getByText('6%')).toBeInTheDocument()
    })
    test('no reminder for a non-BNI target, and modes read as words, not enums', () => {
      const dialog = renderDialog(CURRENT, { mode: 'DYNAMIC' })
      expect(within(dialog).queryByTestId('rate-bni-calibration-reminder')).not.toBeInTheDocument()
      expect(within(dialog).getByText('Otomatis (kurs pasar)')).toBeInTheDocument()
      expect(within(dialog).queryByText('DYNAMIC')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('an emptied X is shown as the active X, unchanged (it is not sent)', () => {
      const dialog = renderDialog({ ...CURRENT, mode: 'BNI' }, { bniRateMaxDeviationPct: '' })
      expect(within(dialog).getByText('3%')).not.toHaveClass('line-through')
    })
    test('the current rate unavailable (null base) reads "—" in the diff', () => {
      const dialog = renderDialog(
        { ...CURRENT, mode: 'BNI', baseRate: null, rateUnavailableReason: 'BNI_UNREACHABLE' },
        { mode: 'MANUAL', manualRate: '16300' },
      )
      expect(within(dialog).getByText('—')).toBeInTheDocument()
      expect(within(dialog).getByText('16.300,00 IDR/USD')).toBeInTheDocument()
    })
  })
})
