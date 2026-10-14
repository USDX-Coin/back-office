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

// USDX-749 (keputusan PM 14 Okt 2026): Transfer BNI = transfer USD. `/api/v1/orders/{id}`
// menambah `totalPayUsd` + `payCurrency`; `totalPayIdr` order itu hanya padanan rupiah.
describe('OrderDetailContent — total bayar Transfer BNI dalam USD', () => {
  const bniUsd: OrderDetail = {
    ...base,
    amount: '3.470000',
    baseRate: '16000.0000',
    effectiveRate: '16000.0000',
    paymentChannel: 'BANK_TRANSFER',
    paymentBank: 'BNI',
    paymentProvider: 'BNI',
    subtotalIdr: '55520.00',
    mintFeePct: '0',
    mintFeeIdr: '0.00',
    pgFeeIdr: '0.00',
    totalFeeIdr: '0.00',
    totalPayIdr: '55520.00',
    totalPayUsd: '3.47',
    payCurrency: 'USD',
  }

  describe('positive', () => {
    test('shows "Total bayar (USD)" $3,47 and the rupiah equivalent on its own line', () => {
      renderWithProviders(<OrderDetailContent detail={bniUsd} />, { authenticated: true })
      expect(field('Total bayar (USD)')).toHaveTextContent('$3,47')
      expect(field('Padanan rupiah (Rp)')).toHaveTextContent(/55\.520/)
      expect(screen.queryByText('Total bayar (Rp)')).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('a rupiah order (payCurrency IDR) keeps "Total bayar (Rp)" and no USD line', () => {
      renderWithProviders(<OrderDetailContent detail={{ ...base, payCurrency: 'IDR', totalPayUsd: null }} />, {
        authenticated: true,
      })
      expect(field('Total bayar (Rp)')).toHaveTextContent(/1\.661\.662/)
      expect(screen.queryByText('Total bayar (USD)')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('USD without totalPayUsd yet shows a dash, never $0', () => {
      renderWithProviders(<OrderDetailContent detail={{ ...bniUsd, totalPayUsd: null }} />, { authenticated: true })
      expect(field('Total bayar (USD)')).toHaveTextContent('—')
      expect(field('Total bayar (USD)')).not.toHaveTextContent('$')
    })

    test('an older backend without payCurrency stays rupiah', () => {
      renderWithProviders(<OrderDetailContent detail={base} />, { authenticated: true })
      expect(field('Total bayar (Rp)')).toBeInTheDocument()
    })
  })
})
