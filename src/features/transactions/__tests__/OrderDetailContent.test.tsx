import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { renderWithProviders } from '@/test/test-utils'
import type { OrderDetail } from '@/lib/types'
import OrderDetailContent from '../OrderDetailContent'

// D25 (backend USDX-749): harga order mint nasabah baru dikunci di `/pay`.
// Order yang belum memilih metode membawa `baseRate` / `effectiveRate` /
// `estimatedRevenueIdr` / biaya `null` — layar wajib menulis "—", bukan
// "0,00 IDR/USD" atau "Rp 0".

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const base: OrderDetail = {
  id: '019e0000-0000-7000-8000-000000000001',
  type: 'MINT',
  userId: '019e0000-0000-7000-8000-0000000000aa',
  userEmail: 'nasabah@example.com',
  partner: null,
  onBehalfOf: null,
  partnerCustomerId: null,
  externalReference: null,
  userAddress: null,
  chain: 'polygon',
  amount: '100.000000',
  baseRate: '16250.0000',
  spreadBuyPct: null,
  spreadSellPct: null,
  effectiveRate: '16412.5000',
  idempotencyKey: null,
  subtotalIdr: '1641250.00',
  paymentChannel: 'VA',
  paymentBank: 'NOBU',
  mintFeePct: '1.0000',
  mintFeeIdr: '16412.50',
  pgFeeIdr: '4000.00',
  totalPayIdr: '1661662.50',
  safeType: null,
  paymentStatus: 'WAITING_FOR_PAYMENT',
  safeStatus: 'NONE',
  paidAt: null,
  safeTxHash: null,
  onChainTxHash: null,
  paymentProvider: 'DURIANPAY_SNAP',
  redeemId: null,
  grossIdr: null,
  redeemFeePct: null,
  redeemFeeIdr: null,
  disbursementFeeIdr: null,
  netPayoutIdr: null,
  bankCode: null,
  bankName: null,
  bankAccountNumber: null,
  bankAccountName: null,
  lateBurn: null,
  payoutRef: null,
  burnTxHash: null,
  burnedAt: null,
  payoutCompletedAt: null,
  payoutProvider: null,
  totalFeeIdr: '20412.50',
  estimatedRevenueIdr: '32662.50',
  status: 'WAITING_FOR_PAYMENT',
  expiresAt: '2026-10-13T08:00:00.000Z',
  createdAt: '2026-10-13T07:00:00.000Z',
  updatedAt: '2026-10-13T07:00:00.000Z',
}

const field = (label: string) => screen.getByText(label).parentElement!

describe('OrderDetailContent — harga order', () => {
  describe('positive', () => {
    test('a paid-for order shows its locked rates and revenue', () => {
      renderWithProviders(<OrderDetailContent detail={base} />, { authenticated: true })
      expect(field('Kurs dasar')).toHaveTextContent('16.250,00 IDR/USD')
      expect(field('Kurs efektif')).toHaveTextContent('16.412,50 IDR/USD')
      expect(screen.getByText('Perkiraan pendapatan').closest('div')!.parentElement).toHaveTextContent(/32\.662/)
    })
  })

  describe('negative', () => {
    test('an order that has not chosen a method yet (prices null) never shows 0', () => {
      const requested: OrderDetail = {
        ...base,
        baseRate: null,
        effectiveRate: null,
        subtotalIdr: null,
        mintFeePct: null,
        mintFeeIdr: null,
        pgFeeIdr: null,
        totalFeeIdr: null,
        totalPayIdr: null,
        estimatedRevenueIdr: null,
        paymentChannel: null,
        paymentBank: null,
        paymentStatus: 'REQUESTED',
      }
      renderWithProviders(<OrderDetailContent detail={requested} />, { authenticated: true })
      expect(field('Kurs dasar')).toHaveTextContent('—')
      expect(field('Kurs efektif')).toHaveTextContent('—')
      expect(field('Biaya mint')).toHaveTextContent('—')
      expect(screen.queryByText(/0,00 IDR\/USD/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Rp\s?0$/)).not.toBeInTheDocument()
      expect(screen.getByTitle(/dikunci saat nasabah memilih metode bayar/i)).toHaveTextContent('—')
    })
  })

  describe('edge cases', () => {
    test('a fee with a percent but no rupiah yet shows the percent and a dash, not Rp 0', () => {
      renderWithProviders(<OrderDetailContent detail={{ ...base, mintFeeIdr: null }} />, { authenticated: true })
      expect(field('Biaya mint')).toHaveTextContent('1%')
      expect(field('Biaya mint')).not.toHaveTextContent('Rp')
    })
  })
})
