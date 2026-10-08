import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'
import LegacyQueueLinks from '../LegacyQueueLinks'

// Redesain fase 1: empat antrean lama keluar dari menu tapi angkanya dijumlah ke
// menu Transaksi — baris ini memastikan halamannya tetap bisa dicapai dari sana.

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const counts = (data: Record<string, number>) =>
  http.get('/api/v1/queue-counts', () => HttpResponse.json({ status: 'success', metadata: null, data }))

describe('LegacyQueueLinks', () => {
  describe('positive', () => {
    test('should link every hidden queue with its own count', async () => {
      server.use(counts({ redeemApprovalsOpen: 12, payoutFailuresOpen: 5, heldCreditsOpen: 3, approvalsOpen: 0 }))
      renderWithProviders(<LegacyQueueLinks />, { authenticated: true })
      expect(await screen.findByRole('link', { name: /Persetujuan Pencairan\s*12/ })).toHaveAttribute('href', '/redeem-approvals')
      expect(screen.getByRole('link', { name: /Pencairan Bermasalah\s*5/ })).toHaveAttribute('href', '/payout-failures')
      expect(screen.getByRole('link', { name: /Mint Bermasalah\s*3/ })).toHaveAttribute('href', '/mint-bermasalah')
      expect(screen.getByRole('link', { name: 'Perbaiki Status Nyangkut' })).toHaveAttribute('href', '/manual-sync')
    })
  })

  describe('negative', () => {
    test('should say "belum terbaca" instead of hiding a failed count', async () => {
      server.use(
        http.get('/api/v1/queue-counts', () =>
          HttpResponse.json({ status: 'error', metadata: null, data: null, error: { code: 'X', message: 'x' } }, { status: 500 }),
        ),
      )
      renderWithProviders(<LegacyQueueLinks />, { authenticated: true })
      expect(await screen.findAllByText('(belum terbaca)')).toHaveLength(3)
    })
  })

  describe('edge cases', () => {
    test('should show no number for an empty queue', async () => {
      server.use(counts({ redeemApprovalsOpen: 0, payoutFailuresOpen: 2, heldCreditsOpen: 0, approvalsOpen: 0 }))
      renderWithProviders(<LegacyQueueLinks />, { authenticated: true })
      expect(await screen.findByRole('link', { name: /Pencairan Bermasalah\s*2/ })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Persetujuan Pencairan' })).toBeInTheDocument()
    })
  })
})
